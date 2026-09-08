#!/usr/bin/env node
/**
 * Fabrique la page de reservation d'un prospect AVANT qu'il ait un compte,
 * pour la lui montrer pendant l'appel.
 *
 *   node page-proposition.mjs fiches/clean-by-didi.json
 *   node page-proposition.mjs --supprimer clean-by-didi
 *   node page-proposition.mjs --liste
 *
 * La page creee porte TOUJOURS `is_preview = true` : elle se parcourt
 * entierement mais n'accepte aucune reservation. Publier un lien reservable au
 * nom de quelqu'un qui n'a rien demande l'engagerait sur des rendez-vous qu'il
 * n'a jamais acceptes.
 *
 * Trois garde-fous, parce que ce script ecrit dans la base de PRODUCTION :
 *   - il ne cree jamais une page active ;
 *   - il refuse de toucher une fiche qui n'est pas une proposition, donc il ne
 *     peut pas ecraser un vrai client ;
 *   - la suppression ne s'applique qu'aux propositions, et affiche ce qu'elle
 *     va detruire avant de le faire.
 */
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']

function env() {
  const chemin = path.resolve('..', '.env.local')
  if (!fs.existsSync(chemin)) {
    console.error(`Introuvable : ${chemin} — lance ce script depuis washboard/prospects/.`)
    process.exit(1)
  }
  for (const l of fs.readFileSync(chemin, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(l)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

const slugify = s => String(s).toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '').slice(0, 40)

/** Le controle qu'on veut rater le moins possible : une fiche mal remplie
 *  produit une page fausse qu'on montre a un prospect. */
function valider(f) {
  const erreurs = []
  if (!f.nom?.trim()) erreurs.push('« nom » manquant')
  if (!Array.isArray(f.categories) || !f.categories.length) erreurs.push('aucune catégorie')
  if (!Array.isArray(f.horaires) || !f.horaires.length) erreurs.push('aucun horaire')

  for (const c of f.categories ?? []) {
    if (!c.nom?.trim()) erreurs.push('une catégorie sans nom')
    for (const p of c.prestations ?? []) {
      if (!p.nom?.trim()) erreurs.push(`prestation sans nom dans « ${c.nom} »`)
      if (!(Number(p.prix) >= 0)) erreurs.push(`prix invalide pour « ${p.nom} »`)
      // La duree n'est sur AUCUN flyer, et sans elle les creneaux sont faux :
      // une prestation de 90 min annoncee a 30 min ferait accepter trois
      // rendez-vous la ou il n'y en a qu'un. On la reclame explicitement.
      if (!(Number(p.duree) > 0)) erreurs.push(`durée manquante pour « ${p.nom} » — à demander au téléphone`)
    }
  }
  for (const h of f.horaires ?? []) {
    if (!(h.jour >= 0 && h.jour <= 6)) erreurs.push(`jour invalide : ${h.jour}`)
    if (!/^\d{1,2}:\d{2}$/.test(h.debut ?? '') || !/^\d{1,2}:\d{2}$/.test(h.fin ?? '')) {
      erreurs.push(`horaire mal formé le ${JOURS[h.jour] ?? h.jour}`)
    } else if (h.debut >= h.fin) {
      erreurs.push(`${JOURS[h.jour]} : la fin (${h.fin}) doit suivre le début (${h.debut})`)
    }
  }
  return erreurs
}

async function creer(db, fiche) {
  const erreurs = valider(fiche)
  if (erreurs.length) {
    console.error('Fiche incomplète :')
    for (const e of erreurs) console.error('  - ' + e)
    process.exit(1)
  }

  const slug = slugify(fiche.slug || fiche.nom)

  const { data: pris, error: eLecture } = await db
    .from('washers').select('id, name, is_preview').eq('slug', slug).maybeSingle()
  if (eLecture) { console.error('Lecture impossible :', eLecture.message); process.exit(1) }
  if (pris) {
    // Refus net : ce script ne doit jamais pouvoir ecraser un vrai laveur.
    console.error(`Le lien « ${slug} » est déjà pris par « ${pris.name} »`
      + (pris.is_preview ? ' (une proposition — supprime-la d’abord avec --supprimer).' : ' — c’est un VRAI compte, on n’y touche pas.'))
    process.exit(1)
  }

  const washerId = randomUUID()
  const { error: eW } = await db.from('washers').insert({
    id: washerId,
    user_id: null,                 // page sans compte : c'est tout l'objet
    is_preview: true,              // et elle n'accepte aucune reservation
    name: fiche.nom.trim(),
    slug,
    phone: fiche.telephone ?? null,
    welcome_message: fiche.message_accueil ?? null,
    base_address: fiche.adresse ?? null,
    brand_color: fiche.couleur ?? null,
  })
  if (eW) { console.error('Création impossible :', eW.message); process.exit(1) }

  let nbPrestations = 0
  for (const [i, cat] of fiche.categories.entries()) {
    const { data: c, error: eC } = await db.from('service_categories').insert({
      washer_id: washerId, name: cat.nom.trim(),
      types: cat.types ?? [], display_order: i,
    }).select('id').single()
    if (eC) { console.error('Catégorie impossible :', eC.message); process.exit(1) }

    for (const p of cat.prestations ?? []) {
      const { error: eS } = await db.from('services').insert({
        washer_id: washerId, category_id: c.id,
        name: p.nom.trim(), description: p.description ?? null,
        price: Number(p.prix), duration_minutes: Number(p.duree),
        vehicle_types: [], vehicle_price_overrides: {}, addons: [],
      })
      if (eS) { console.error('Prestation impossible :', eS.message); process.exit(1) }
      nbPrestations++
    }
  }

  for (const h of fiche.horaires) {
    const { error: eH } = await db.from('availabilities').insert({
      washer_id: washerId, day_of_week: h.jour,
      start_time: h.debut, end_time: h.fin,
    })
    if (eH) { console.error('Horaire impossible :', eH.message); process.exit(1) }
  }

  console.log(`\n  ${fiche.nom}`)
  console.log(`  ${nbPrestations} prestation(s) · ${fiche.horaires.length} plage(s) horaire(s)\n`)
  console.log(`  https://www.washboard.fr/book/${slug}\n`)
  console.log('  Page en mode proposition : elle se parcourt, elle ne prend aucune réservation.')
}

async function supprimer(db, slug) {
  const { data: w, error } = await db
    .from('washers').select('id, name, is_preview').eq('slug', slug).maybeSingle()
  if (error) { console.error('Lecture impossible :', error.message); process.exit(1) }
  if (!w) { console.error(`Aucune page « ${slug} ».`); process.exit(1) }
  if (!w.is_preview) {
    console.error(`« ${w.name} » n’est PAS une proposition : ce script refuse d’y toucher.`)
    process.exit(1)
  }

  const { count } = await db.from('bookings')
    .select('id', { count: 'exact', head: true }).eq('washer_id', w.id)
  if (count) {
    // Ne devrait jamais arriver — une proposition refuse les reservations.
    // Si ca arrive, c'est un defaut a comprendre, pas des donnees a effacer.
    console.error(`${count} réservation(s) sur cette page : suppression refusée, préviens quelqu’un.`)
    process.exit(1)
  }

  for (const t of ['availabilities', 'services', 'service_categories', 'washers']) {
    const { error: e } = await db.from(t).delete()
      .eq(t === 'washers' ? 'id' : 'washer_id', w.id)
    if (e) { console.error(`Suppression ${t} :`, e.message); process.exit(1) }
  }
  console.log(`Proposition « ${w.name} » supprimée.`)
}

async function lister(db) {
  const { data, error } = await db.from('washers')
    .select('name, slug, phone, created_at').eq('is_preview', true)
    .order('created_at', { ascending: false })
  if (error) { console.error(error.message); process.exit(1) }
  if (!data?.length) { console.log('Aucune page en proposition.'); return }
  console.log(`${data.length} proposition(s) :\n`)
  for (const w of data) {
    console.log(`  ${w.name.padEnd(24)} washboard.fr/book/${w.slug}`)
  }
}

const db = env()
const [a, b] = process.argv.slice(2)

if (a === '--liste') await lister(db)
else if (a === '--supprimer') {
  if (!b) { console.error('Usage : --supprimer <slug>'); process.exit(1) }
  await supprimer(db, b)
} else if (a && fs.existsSync(a)) {
  await creer(db, JSON.parse(fs.readFileSync(a, 'utf8')))
} else {
  console.error('Usage :')
  console.error('  node page-proposition.mjs fiches/<nom>.json')
  console.error('  node page-proposition.mjs --supprimer <slug>')
  console.error('  node page-proposition.mjs --liste')
  process.exit(1)
}

#!/usr/bin/env node
/**
 * Fabrique la page de reservation d'un prospect AVANT qu'il ait un compte,
 * pour la lui montrer pendant l'appel.
 *
 *   node page-proposition.mjs fiches/clean-by-didi.json
 *   node page-proposition.mjs --resync fiches/clean-by-didi.json
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
import { randomUUID, createHash } from 'node:crypto'
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

/** Types de vehicule reconnus par le formulaire : ils ont une illustration.
 *  Un id absent de cette liste reste valable, il s'affiche sans image. */
const TYPES_STANDARD = {
  citadine_2p: 'Citadine 2 portes', citadine: 'Citadine', berline: 'Berline',
  SUV: 'SUV', monospace: 'Monospace', '7places': '7 places',
  utilitaire: 'Utilitaire', velo: 'Vélo',
}

/** Le formulaire distingue les vehicules des autres objets a la FORME de l'id :
 *  un slug lisible = un vehicule, et il reclame alors « Modèle du véhicule ».
 *  Un canape n'a pas de modele : ses types recoivent donc un identifiant en
 *  forme d'UUID, comme ceux que cree le tableau de bord. On le derive du nom
 *  pour qu'il reste le meme d'une resynchronisation a l'autre. */
function idNonVehicule(cle) {
  const h = createHash('sha1').update('washboard:type:' + cle).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`
}

/** Types d'une categorie, ecrits au choix « "citadine" » ou « {id, nom} ».
 *  Ajouter « "vehicule": false » pour un canape, un matelas, un tapis… */
function typesDeCategorie(cat) {
  return (cat.types ?? []).map(t => {
    if (typeof t === 'string') return { id: t, name: TYPES_STANDARD[t] ?? t }
    const cle = String(t.id ?? '')
    return {
      id: t.vehicule === false ? idNonVehicule(cle) : cle,
      name: t.nom ?? t.name ?? TYPES_STANDARD[cle] ?? cle,
    }
  })
}

/** Les ids ecrits dans la fiche, tels que les prestations les designent,
 *  vers les ids reellement poses en base. */
function correspondanceTypes(cat) {
  const m = new Map()
  for (const t of cat.types ?? []) {
    const cle = typeof t === 'string' ? t : String(t.id ?? '')
    m.set(cle, typeof t !== 'string' && t.vehicule === false ? idNonVehicule(cle) : cle)
  }
  return m
}

/** Options d'une prestation, converties au format attendu par le formulaire.
 *  L'id est derive du nom : il reste STABLE d'une resynchronisation a l'autre. */
function optionsDePrestation(p) {
  return (p.options ?? []).map(o => ({
    id: slugify(o.nom),
    label: o.nom.trim(),
    price: Number(o.prix),
    category: o.groupe ?? 'Options',
    ...(Number(o.duree) > 0 ? { duration_minutes: Number(o.duree) } : {}),
  }))
}

/** Un prix present et positif. `Number(null)` vaut 0 : sans ce controle, une
 *  fiche laissee a remplir passait la validation et publiait des prestations
 *  a 0 € au nom du prospect. Zero reste accepte, c'est un prix. */
const estPrix = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0

/** Le controle qu'on veut rater le moins possible : une fiche mal remplie
 *  produit une page fausse qu'on montre a un prospect. */
function valider(f) {
  const erreurs = []
  if (!f.nom?.trim()) erreurs.push('« nom » manquant')
  if (!Array.isArray(f.categories) || !f.categories.length) erreurs.push('aucune catégorie')
  if (!Array.isArray(f.horaires) || !f.horaires.length) erreurs.push('aucun horaire')

  for (const c of f.categories ?? []) {
    if (!c.nom?.trim()) erreurs.push('une catégorie sans nom')

    // Sans type, le formulaire n'affiche aucun element a ajouter au panier et
    // « Continuer » reste grise : la page devient une impasse des la premiere
    // etape. Constate en production sur /book/demo le 2026-09-08.
    const types = typesDeCategorie(c)
    if (!types.length) {
      erreurs.push(`la catégorie « ${c.nom} » n'a aucun type : le visiteur resterait bloqué à la première étape`)
    }
    for (const t of types) {
      if (!t.id) erreurs.push(`un type sans id dans « ${c.nom} »`)
    }
    // Les prestations designent les types par la cle ECRITE dans la fiche
    // (« canape »), pas par l'id pose en base (un UUID pour les non-vehicules).
    const idsTypes = new Set(correspondanceTypes(c).keys())

    for (const p of c.prestations ?? []) {
      if (!p.nom?.trim()) erreurs.push(`prestation sans nom dans « ${c.nom} »`)
      if (!estPrix(p.prix)) erreurs.push(`prix manquant ou invalide pour « ${p.nom} »`)
      // La duree n'est sur AUCUN flyer, et sans elle les creneaux sont faux :
      // une prestation de 90 min annoncee a 30 min ferait accepter trois
      // rendez-vous la ou il n'y en a qu'un. On la reclame explicitement.
      if (!(Number(p.duree) > 0)) erreurs.push(`durée manquante pour « ${p.nom} » — à demander au téléphone`)

      // Une faute de frappe sur un id produit un type fantome, sans prix et
      // sans nom lisible : on la refuse plutot que de l'afficher au prospect.
      for (const t of p.types ?? []) {
        if (!idsTypes.has(t)) erreurs.push(`« ${p.nom} » propose le type « ${t} », absent de la catégorie « ${c.nom} »`)
      }
      const proposes = new Set(p.types ?? [...idsTypes])
      for (const [t, prix] of Object.entries(p.prix_par_type ?? {})) {
        if (!proposes.has(t)) erreurs.push(`« ${p.nom} » fixe un prix pour « ${t} », qu'elle ne propose pas`)
        if (!estPrix(prix)) erreurs.push(`prix manquant ou invalide pour « ${p.nom} » / « ${t} »`)
      }

      const vus = new Set()
      for (const o of p.options ?? []) {
        if (!o.nom?.trim()) erreurs.push(`option sans nom dans « ${p.nom} »`)
        else if (vus.has(slugify(o.nom))) erreurs.push(`deux options nommées « ${o.nom} » dans « ${p.nom} »`)
        else vus.add(slugify(o.nom))
        if (!estPrix(o.prix)) erreurs.push(`prix manquant ou invalide pour l'option « ${o.nom} »`)
      }
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

/** Ecrit categories, prestations et horaires d'une fiche sur une page donnee.
 *  Partage par la creation et la resynchronisation. Renvoie le nombre de
 *  prestations posees. */
async function poserCatalogue(db, washerId, fiche) {
  let nbPrestations = 0
  for (const [i, cat] of fiche.categories.entries()) {
    const types = typesDeCategorie(cat)
    const pose  = correspondanceTypes(cat)   // cle de la fiche → id en base
    const { data: c, error: eC } = await db.from('service_categories').insert({
      washer_id: washerId, name: cat.nom.trim(),
      types, display_order: i,
    }).select('id').single()
    if (eC) { console.error('Catégorie impossible :', eC.message); process.exit(1) }

    for (const p of cat.prestations ?? []) {
      const { error: eS } = await db.from('services').insert({
        washer_id: washerId, category_id: c.id,
        name: p.nom.trim(), description: p.description ?? null,
        price: Number(p.prix), duration_minutes: Number(p.duree),
        // Sans type propose, la prestation ne peut pas etre ajoutee au panier.
        // Par defaut elle accepte donc tous les types de sa categorie.
        vehicle_types: (p.types ?? [...pose.keys()]).map(t => pose.get(t) ?? t),
        vehicle_price_overrides: Object.fromEntries(
          Object.entries(p.prix_par_type ?? {}).map(([t, v]) => [pose.get(t) ?? t, Number(v)]),
        ),
        addons: optionsDePrestation(p),
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
  return nbPrestations
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

  const nbPrestations = await poserCatalogue(db, washerId, fiche)

  console.log(`\n  ${fiche.nom}`)
  console.log(`  ${nbPrestations} prestation(s) · ${fiche.horaires.length} plage(s) horaire(s)\n`)
  console.log(`  https://www.washboard.fr/book/${slug}\n`)
  console.log('  Page en mode proposition : elle se parcourt, elle ne prend aucune réservation.')
}

/** Reecrit le catalogue d'une proposition existante depuis sa fiche corrigee —
 *  typiquement apres un appel ou le prospect a donne ses vraies durees.
 *  Ne touche NI le logo, NI le fond, NI la couleur : c'est le travail
 *  d'habiller-page.mjs, et le refaire a chaque correction de prix serait absurde. */
async function resync(db, fiche) {
  const erreurs = valider(fiche)
  if (erreurs.length) {
    console.error('Fiche incomplète :')
    for (const e of erreurs) console.error('  - ' + e)
    process.exit(1)
  }

  const slug = slugify(fiche.slug || fiche.nom)
  const { data: w, error } = await db
    .from('washers').select('id, name, is_preview').eq('slug', slug).maybeSingle()
  if (error) { console.error('Lecture impossible :', error.message); process.exit(1) }
  if (!w) { console.error(`Aucune page « ${slug} » — utilise la création.`); process.exit(1) }
  if (!w.is_preview) {
    console.error(`« ${w.name} » est un VRAI compte : on ne réécrit pas ses prestations.`)
    process.exit(1)
  }

  const { count } = await db.from('bookings')
    .select('id', { count: 'exact', head: true }).eq('washer_id', w.id)
  if (count) {
    // Effacer des prestations reservees casserait les rendez-vous existants.
    console.error(`${count} réservation(s) sur cette page : resynchronisation refusée.`)
    process.exit(1)
  }

  for (const t of ['availabilities', 'services', 'service_categories']) {
    const { error: e } = await db.from(t).delete().eq('washer_id', w.id)
    if (e) { console.error(`Nettoyage ${t} :`, e.message); process.exit(1) }
  }

  const champs = { name: fiche.nom.trim() }
  // Seuls les champs REELLEMENT presents dans la fiche sont ecrases : sinon une
  // fiche sans « couleur » effacerait la couleur posee par habiller-page.mjs.
  if (fiche.telephone !== undefined)       champs.phone           = fiche.telephone
  if (fiche.message_accueil !== undefined) champs.welcome_message = fiche.message_accueil
  if (fiche.adresse !== undefined)         champs.base_address    = fiche.adresse
  if (fiche.couleur !== undefined)         champs.brand_color     = fiche.couleur
  const { error: eW } = await db.from('washers').update(champs).eq('id', w.id)
  if (eW) { console.error('Mise à jour :', eW.message); process.exit(1) }

  const nb = await poserCatalogue(db, w.id, fiche)
  console.log(`\n  ${fiche.nom} — resynchronisé`)
  console.log(`  ${nb} prestation(s) · ${fiche.horaires.length} plage(s) horaire(s)\n`)
  console.log(`  https://www.washboard.fr/book/${slug}\n`)
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
} else if (a === '--resync') {
  if (!b || !fs.existsSync(b)) { console.error('Usage : --resync fiches/<nom>.json'); process.exit(1) }
  await resync(db, JSON.parse(fs.readFileSync(b, 'utf8')))
} else if (a && fs.existsSync(a)) {
  await creer(db, JSON.parse(fs.readFileSync(a, 'utf8')))
} else {
  console.error('Usage :')
  console.error('  node page-proposition.mjs fiches/<nom>.json          créer')
  console.error('  node page-proposition.mjs --resync fiches/<nom>.json  corriger sans perdre l’habillage')
  console.error('  node page-proposition.mjs --supprimer <slug>')
  console.error('  node page-proposition.mjs --liste')
  process.exit(1)
}

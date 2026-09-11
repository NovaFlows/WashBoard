#!/usr/bin/env node
/**
 * Le prospect vient de s'inscrire : on reprend sa page d'aperçu dans son compte.
 *
 *   node reprendre-apercu.mjs <slug-apercu> <email-du-compte>         affiche le plan, n'écrit rien
 *   node reprendre-apercu.mjs <slug-apercu> <email-du-compte> --go    exécute
 *
 * L'inscription crée toujours un laveur NEUF et vide, avec un lien du type
 * « urhus-auto-3fa1 » : elle ne sait rien de la page construite avant l'appel.
 * Sans ce script, le prospect retrouverait un compte vierge, et le lien qu'on
 * lui a montré resterait un aperçu qui refuse toute réservation.
 *
 * Ce qui passe de l'aperçu au compte : catégories, prestations, horaires,
 * logo, fond, couleur, message d'accueil, adresse, frais de déplacement.
 * Ce qui reste au compte : son nom, son téléphone, son essai, son abonnement.
 * Puis l'aperçu est supprimé et son lien est attribué au compte.
 *
 * Garde-fous, parce que ce script écrit sur un VRAI compte :
 *   - sans --go, il n'écrit rien et montre exactement ce qu'il ferait ;
 *   - il refuse un compte qui a déjà des prestations ou des réservations :
 *     on ne recouvre jamais ce qu'un laveur a configuré lui-même ;
 *   - il refuse un aperçu qui aurait des réservations.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

// Présentation de la page : ce qui a été construit avec soin avant l'appel.
// Le nom et le téléphone restent ceux que le laveur a saisis en s'inscrivant.
const CHAMPS_PAGE = [
  'logo_url', 'background_theme', 'brand_color', 'welcome_message',
  'base_address', 'travel_fee_mode', 'travel_fee_tiers', 'zone_config', 'website_url',
]

function base() {
  const chemin = path.resolve('..', '.env.local')
  if (!fs.existsSync(chemin)) { console.error('Lance ce script depuis washboard/prospects/.'); process.exit(1) }
  for (const l of fs.readFileSync(chemin, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(l)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } })
}

const stop = msg => { console.error('\n  ✗ ' + msg + '\n'); process.exit(1) }
const compter = async (db, table, id) =>
  (await db.from(table).select('id', { count: 'exact', head: true }).eq('washer_id', id)).count ?? 0

const [slugApercu, email, drapeau] = process.argv.slice(2)
if (!slugApercu || !email) {
  console.error('Usage : node reprendre-apercu.mjs <slug-apercu> <email-du-compte> [--go]')
  process.exit(1)
}
const go = drapeau === '--go'
const db = base()

// ── L'aperçu ────────────────────────────────────────────────────────────────
const { data: apercu } = await db.from('washers').select('*').eq('slug', slugApercu).maybeSingle()
if (!apercu) stop(`Aucune page « ${slugApercu} ».`)
if (!apercu.is_preview || apercu.user_id) stop(`« ${apercu.name} » n'est pas un aperçu : rien à reprendre.`)
if (await compter(db, 'bookings', apercu.id)) stop('Cet aperçu porte des réservations — anormal, à comprendre avant de toucher à quoi que ce soit.')

// ── Le compte ───────────────────────────────────────────────────────────────
const { data: { users }, error: eUsers } = await db.auth.admin.listUsers({ perPage: 1000 })
if (eUsers) stop('Lecture des comptes impossible : ' + eUsers.message)
const utilisateur = users.find(u => u.email?.toLowerCase() === email.toLowerCase())
if (!utilisateur) stop(`Aucun compte avec l'email ${email} — il ne s'est pas encore inscrit, ou avec une autre adresse.`)

const { data: comptes } = await db.from('washers').select('*').eq('user_id', utilisateur.id)
if (!comptes?.length) stop('Ce compte n\'a pas de fiche laveur — inscription inachevée.')
if (comptes.length > 1) stop('Ce compte porte plusieurs fiches laveur — anormal, à regarder à la main.')
const compte = comptes[0]
if (compte.is_preview) stop('La fiche de ce compte est marquée aperçu — anormal.')

const [dejaServices, dejaResas] = [await compter(db, 'services', compte.id), await compter(db, 'bookings', compte.id)]
if (dejaServices || dejaResas) {
  stop(`Le compte a déjà ${dejaServices} prestation(s) et ${dejaResas} réservation(s) : on ne recouvre pas ce qu'il a configuré.`)
}

// ── Le plan ─────────────────────────────────────────────────────────────────
const { data: cats } = await db.from('service_categories').select('*').eq('washer_id', apercu.id).order('display_order')
// L'ordre de création EST l'ordre d'affichage des prestations : on les recopie
// une à une, dans cet ordre, pour que la page du compte reste identique.
const { data: services } = await db.from('services').select('*').eq('washer_id', apercu.id).order('created_at')
const { data: horaires } = await db.from('availabilities').select('*').eq('washer_id', apercu.id).order('day_of_week')
const copie = Object.fromEntries(CHAMPS_PAGE.filter(k => apercu[k] !== null).map(k => [k, apercu[k]]))

console.log(`
  aperçu   ${apercu.name}  (washboard.fr/book/${apercu.slug})
  compte   ${compte.name}  (washboard.fr/book/${compte.slug})  —  ${email}

  repris   ${cats.length} catégorie(s) · ${services.length} prestation(s) · ${horaires.length} plage(s) horaire(s)
           ${Object.keys(copie).join(', ') || '(aucun champ de présentation)'}
  gardé    nom « ${compte.name} », téléphone ${compte.phone ?? '—'}, essai jusqu'au ${String(compte.trial_ends_at).slice(0, 10)}

  ensuite  l'aperçu est supprimé, et le compte prend le lien washboard.fr/book/${apercu.slug}
`)
if (!go) { console.log('  Rien n\'a été écrit. Relance avec --go pour exécuter.\n'); process.exit(0) }

// ── Exécution ───────────────────────────────────────────────────────────────
// Pas de transaction possible à travers l'API : les étapes sont ordonnées pour
// que rien ne se perde en cas d'arrêt. On COPIE d'abord, on SUPPRIME ensuite.
const fait = []
const echec = (etape, e) => {
  console.error(`\n  ✗ Échec à l'étape « ${etape} » : ${e.message}`)
  console.error(`  Déjà fait : ${fait.join(' → ') || 'rien'}\n`)
  process.exit(1)
}

{ const { error } = await db.from('washers').update(copie).eq('id', compte.id)
  if (error) echec('présentation', error); fait.push('présentation') }

const nouvelleCat = new Map()
for (const c of cats) {
  const { data, error } = await db.from('service_categories')
    .insert({ washer_id: compte.id, name: c.name, types: c.types, display_order: c.display_order })
    .select('id').single()
  if (error) echec('catégories', error)
  nouvelleCat.set(c.id, data.id)
}
fait.push(`${cats.length} catégorie(s)`)

for (const s of services) {
  const { error } = await db.from('services').insert({
    washer_id: compte.id,
    category_id: s.category_id ? nouvelleCat.get(s.category_id) ?? null : null,
    name: s.name, description: s.description, price: s.price,
    duration_minutes: s.duration_minutes, vehicle_types: s.vehicle_types,
    vehicle_price_overrides: s.vehicle_price_overrides, addons: s.addons,
  })
  if (error) echec('prestations', error)
}
fait.push(`${services.length} prestation(s)`)

if (horaires.length) {
  const { error } = await db.from('availabilities').insert(horaires.map(h => ({
    washer_id: compte.id, day_of_week: h.day_of_week, start_time: h.start_time, end_time: h.end_time,
  })))
  if (error) echec('horaires', error)
}
fait.push(`${horaires.length} horaire(s)`)

// Le logo et le fond restent dans le stockage sous l'identifiant de l'aperçu :
// seules les lignes sont supprimées, les adresses copiées restent valides.
for (const t of ['availabilities', 'services', 'service_categories']) {
  const { error } = await db.from(t).delete().eq('washer_id', apercu.id)
  if (error) echec(`suppression de l'aperçu (${t})`, error)
}
{ const { error } = await db.from('washers').delete().eq('id', apercu.id)
  if (error) echec('suppression de l\'aperçu', error); fait.push('aperçu supprimé') }

{ const { error } = await db.from('washers').update({ slug: apercu.slug }).eq('id', compte.id)
  if (error) echec(`lien « ${apercu.slug} » (le contenu est déjà dans le compte ; le laveur peut changer son lien dans Paramètres)`, error)
  fait.push('lien attribué') }

console.log(`  ✓ ${fait.join(' → ')}\n\n  https://www.washboard.fr/book/${apercu.slug}\n`)

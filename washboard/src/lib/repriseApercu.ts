// Reprise automatique d'un aperçu à l'inscription.
//
// Un aperçu est une page construite AVANT l'appel d'un prospect, à son nom et
// avec son numéro (`is_preview = true`, sans compte). Quand il s'inscrit avec ce
// numéro, sa page doit passer dans son compte toute seule : avant, c'était
// `prospects/reprendre-apercu.mjs`, lancé à la main pendant le rendez-vous.
//
// Le numéro n'est PAS vérifié (aucun code SMS), et celui d'un prospect est
// souvent public. N'importe qui pourrait donc récupérer une page, son logo et
// son lien en s'inscrivant avec ce numéro. Parade retenue : la reprise se fait,
// mais l'équipe est prévenue à chaque fois (voir `annonceReprise`), pour qu'un
// détournement saute aux yeux.
//
// L'appelant (l'inscription) ne doit jamais échouer à cause d'elle : la
// fonction ne lève pas sur une erreur de base, elle la décrit.

import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizePhone } from './phone'

/** Présentation de la page : ce qui a été construit avec soin avant l'appel.
 *  Le nom et le téléphone restent ceux que le laveur a saisis en s'inscrivant. */
export const CHAMPS_PAGE = [
  'logo_url', 'background_theme', 'brand_color', 'welcome_message',
  'base_address', 'travel_fee_mode', 'travel_fee_tiers', 'zone_config', 'website_url',
] as const

type Ligne = Record<string, unknown>
type RefApercu = { name: string; slug: string }

export type ResultatReprise =
  | { statut: 'aucun' }
  | { statut: 'reprise'; apercu: RefApercu }
  | { statut: 'ambigu'; apercus: string[] }
  | { statut: 'refuse'; apercu: RefApercu; raison: string }
  | { statut: 'echec'; apercu?: RefApercu; etape: string; fait: string[] }

/** Ce qui rattache une ligne à l'aperçu. Tout le reste est copié : une colonne
 *  ajoutée depuis l'écriture de ce code passe quand même dans le compte. */
const IDENTITE = ['id', 'washer_id', 'created_at']

export function copieSans(ligne: Ligne, cles: readonly string[]): Ligne {
  return Object.fromEntries(Object.entries(ligne).filter(([k]) => !cles.includes(k)))
}

/** Reprend dans `compte` l'aperçu qui porte son numéro, s'il y en a un seul.
 *
 *  Pas de transaction possible à travers l'API : les étapes sont ordonnées pour
 *  que rien ne se perde en cas d'arrêt. On COPIE d'abord, on SUPPRIME l'aperçu
 *  ensuite (ses prestations, horaires et visites partent avec lui, en cascade),
 *  et le lien ne change de main qu'en dernier — il est unique en base. */
export async function reprendreApercu(
  db: SupabaseClient,
  compte: { id: string; phone: string },
): Promise<ResultatReprise> {
  // Le numéro d'un aperçu est parfois stocké tel qu'écrit dans la fiche
  // (« 06 12 34 56 78 ») : on compare les formes normalisées, pas les chaînes.
  // Les aperçus se comptent en dizaines, on peut tous les lire.
  const { data: apercus, error } = await db
    .from('washers').select('*').eq('is_preview', true).is('user_id', null)
  if (error) return { statut: 'echec', etape: 'lecture des aperçus', fait: [] }

  const trouves = ((apercus ?? []) as Ligne[])
    .filter(a => normalizePhone(a.phone as string | null) === compte.phone)
  if (trouves.length === 0) return { statut: 'aucun' }
  // Deux pages au même numéro : impossible de savoir laquelle est la bonne.
  if (trouves.length > 1) return { statut: 'ambigu', apercus: trouves.map(a => String(a.name)) }

  const apercu = trouves[0]
  const id = String(apercu.id)
  const ref: RefApercu = { name: String(apercu.name), slug: String(apercu.slug) }
  const fait: string[] = []
  const echec = (etape: string): ResultatReprise => ({ statut: 'echec', apercu: ref, etape, fait })

  const { count: resas, error: eResas } = await db
    .from('bookings').select('id', { count: 'exact', head: true }).eq('washer_id', id)
  if (eResas) return echec('lecture des réservations')
  // Un aperçu refuse toute réservation : s'il en porte, c'est anormal, et le
  // supprimer effacerait des rendez-vous. À comprendre à la main.
  if (resas) return { statut: 'refuse', apercu: ref, raison: `${resas} réservation(s) sur l'aperçu` }

  const [cats, services, horaires] = await Promise.all([
    db.from('service_categories').select('*').eq('washer_id', id).order('display_order'),
    // L'ordre de création EST l'ordre d'affichage des prestations : on les
    // recopie une à une, dans cet ordre, pour que la page reste identique.
    db.from('services').select('*').eq('washer_id', id).order('created_at'),
    db.from('availabilities').select('*').eq('washer_id', id),
  ])
  if (cats.error || services.error || horaires.error) return echec('lecture du contenu')
  const lignesCats = (cats.data ?? []) as Ligne[]
  const lignesServices = (services.data ?? []) as Ligne[]
  const lignesHoraires = (horaires.data ?? []) as Ligne[]

  const presentation = Object.fromEntries(
    CHAMPS_PAGE.filter(k => apercu[k] !== null && apercu[k] !== undefined).map(k => [k, apercu[k]]),
  )
  if (Object.keys(presentation).length) {
    const { error: e } = await db.from('washers').update(presentation).eq('id', compte.id)
    if (e) return echec('présentation')
  }
  fait.push('présentation')

  const nouvelleCat = new Map<string, string>()
  for (const c of lignesCats) {
    const { data, error: e } = await db.from('service_categories')
      .insert({ ...copieSans(c, IDENTITE), washer_id: compte.id }).select('id').single()
    if (e || !data) return echec('catégories')
    nouvelleCat.set(String(c.id), String((data as Ligne).id))
  }
  fait.push(`${lignesCats.length} catégorie(s)`)

  for (const s of lignesServices) {
    const { error: e } = await db.from('services').insert({
      ...copieSans(s, IDENTITE),
      washer_id: compte.id,
      category_id: s.category_id ? nouvelleCat.get(String(s.category_id)) ?? null : null,
    })
    if (e) return echec('prestations')
  }
  fait.push(`${lignesServices.length} prestation(s)`)

  if (lignesHoraires.length) {
    const { error: e } = await db.from('availabilities')
      .insert(lignesHoraires.map(h => ({ ...copieSans(h, IDENTITE), washer_id: compte.id })))
    if (e) return echec('horaires')
  }
  fait.push(`${lignesHoraires.length} horaire(s)`)

  // Les filtres répètent ce qu'est un aperçu : cette ligne ne peut viser un vrai
  // compte, même si l'identifiant était faux.
  const { error: eSuppr } = await db.from('washers').delete()
    .eq('id', id).eq('is_preview', true).is('user_id', null)
  if (eSuppr) return echec('suppression de l’aperçu')
  fait.push('aperçu supprimé')

  const { error: eLien } = await db.from('washers').update({ slug: ref.slug }).eq('id', compte.id)
  if (eLien) return echec('attribution du lien')

  return { statut: 'reprise', apercu: ref }
}

/** Ce que la notification d'inscription dit de la reprise à l'équipe. Une
 *  reprise réussie est annoncée aussi fort qu'un échec : c'est elle qui
 *  permettrait de repérer quelqu'un qui s'inscrit avec le numéro d'un autre. */
export function annonceReprise(r: ResultatReprise): { titre: string; lignes: string[] } {
  switch (r.statut) {
    case 'aucun':
      return { titre: '🎉 Nouveau client WashBoard', lignes: [] }
    case 'reprise':
      return {
        titre: '🔁 Nouveau client — aperçu repris',
        lignes: [
          `🔁 A repris l'aperçu « ${r.apercu.name} » (/book/${r.apercu.slug})`,
          '👀 Numéro non vérifié : vérifiez que c’est bien le prospect',
        ],
      }
    case 'ambigu':
      return {
        titre: '⚠️ Nouveau client — aperçu à reprendre à la main',
        lignes: [`⚠️ ${r.apercus.length} aperçus portent ce numéro (${r.apercus.join(', ')}) : rien repris`],
      }
    case 'refuse':
      return {
        titre: '⚠️ Nouveau client — aperçu à reprendre à la main',
        lignes: [`⚠️ Aperçu « ${r.apercu.name} » non repris : ${r.raison}`],
      }
    case 'echec':
      return {
        titre: '❌ Nouveau client — reprise d’aperçu échouée',
        lignes: [
          `❌ ${r.apercu ? `« ${r.apercu.name} » : ` : ''}échec à l'étape « ${r.etape} »`,
          `Déjà fait : ${r.fait.join(', ') || 'rien'} — à finir à la main`,
        ],
      }
  }
}

import type { SupabaseClient } from '@supabase/supabase-js'
import { debutDuMoisParis } from '@/lib/plan'

// Réservations au-delà du quota mensuel : le client réserve, le laveur ne voit
// rien.
//
// Le plafond de l'offre gratuite refusait la réservation. Le client repartait,
// et c'est LUI qui payait la limite d'un logiciel qu'il n'a pas choisi — le
// laveur perdait un lavage sans même savoir qu'on l'avait sollicité.
//
// Désormais la réservation est enregistrée normalement. Ce qui est plafonné,
// c'est ce que le laveur en VOIT : au-delà de son quota, il sait qu'une demande
// est arrivée, sans le nom, sans le téléphone, sans l'adresse et sans l'heure.
// La pression change de camp : elle pèse sur celui qui peut y remédier.
//
// Rien n'est écrit en base pour marquer ces réservations, et c'est voulu : le
// verrouillage se DÉDUIT du quota en cours. Le jour où le laveur change
// d'offre, tout ce qui était masqué s'ouvre d'un coup, sans migration ni
// rattrapage. Une colonne aurait figé une décision qui doit pouvoir changer.

/** Réservation minimale pour décider du verrouillage. */
type Datee = { created_at?: string | null }

/** Vrai si cette réservation est arrivée après l'épuisement du quota.
 *
 *  La comparaison porte sur des instants, pas sur des chaînes : Postgres rend
 *  ses dates avec un nombre variable de décimales et un décalage explicite
 *  (`2026-09-24T10:37:06.323578+00:00`), deux écritures du même instant ne se
 *  comparent donc pas caractère par caractère. */
export function estVerrouillee(r: Datee | null | undefined, seuil: string | null): boolean {
  if (!seuil || !r?.created_at) return false
  const t = new Date(r.created_at).getTime()
  const s = new Date(seuil).getTime()
  if (Number.isNaN(t) || Number.isNaN(s)) return false
  return t > s
}

/** Ce qu'on montre à la place d'une réservation verrouillée.
 *
 *  Le masquage se fait ICI, au sortir de la base, et jamais dans les écrans :
 *  un composant qui oublierait la règle afficherait le vrai nom du client. À
 *  cet endroit, l'oubli est impossible — la donnée n'existe déjà plus. */
const MASQUE = {
  client_name: 'Réservation bloquée',
  client_email: null,
  client_phone: null,
  address: null,
  notes: null,
  booked_price: null,
  vehicles_detail: null,
  selected_addons: null,
  company_name: null,
  siret: null,
  billing_address: null,
} as const

/** Remplace, dans une liste lue en base, tout ce qu'une réservation
 *  verrouillée ne doit pas laisser voir. L'heure et la date restent : le laveur
 *  doit pouvoir constater qu'un créneau est pris, sinon il promettrait le même
 *  à quelqu'un d'autre. */
export function masquerVerrouillees<T extends Datee>(
  reservations: T[],
  seuil: string | null,
): (T & { verrouillee: boolean })[] {
  return reservations.map(r =>
    estVerrouillee(r, seuil)
      ? { ...r, ...MASQUE, verrouillee: true }
      : { ...r, verrouillee: false },
  )
}

/** Instant après lequel les réservations du mois sont verrouillées.
 *
 *  C'est la date de création de la DERNIÈRE réservation comprise dans le quota.
 *  `null` quand l'offre n'a pas de plafond, ou que le mois n'a pas encore
 *  atteint la limite — dans les deux cas, rien n'est masqué.
 *
 *  Un seul instant suffit à trancher pour toute la base : pas besoin de
 *  recalculer un rang à chaque écran, il reste à comparer une date.
 */
export async function seuilVerrouillage(
  // Le client Supabase n'est pas typé dans ce projet (voir washerCourant).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  washerId: string,
  quota: number | null,
  now: Date = new Date(),
): Promise<string | null> {
  if (quota === null || quota <= 0) return null

  const { data, error } = await supabase
    .from('bookings')
    .select('created_at')
    .eq('washer_id', washerId)
    .neq('status', 'cancelled')
    .gte('created_at', debutDuMoisParis(now).toISOString())
    .order('created_at', { ascending: true })
    .range(quota - 1, quota - 1)

  // Sans certitude, on ne masque rien : cacher les coordonnées d'un client à un
  // laveur qui y a droit lui ferait rater un vrai rendez-vous. Le sens du
  // doute va toujours vers le laveur.
  if (error || !data?.length) return null
  return data[0].created_at as string
}

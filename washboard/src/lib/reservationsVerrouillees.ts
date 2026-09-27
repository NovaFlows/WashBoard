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
// c'est ce que le laveur en VOIT : au-delà de son quota, il connaît LE NOM et
// LE JOUR, rien d'autre. Assez pour savoir qu'un vrai client l'attend, trop peu
// pour le joindre ou pour honorer le rendez-vous sans rien payer.
// La pression change de camp : elle pèse sur celui qui peut y remédier.
//
// Rien n'est écrit en base pour marquer ces réservations, et c'est voulu : le
// verrouillage se DÉDUIT du quota en cours. Le jour où le laveur change
// d'offre, tout ce qui était masqué s'ouvre d'un coup, sans migration ni
// rattrapage. Une colonne aurait figé une décision qui doit pouvoir changer.

/** Réservation minimale pour décider du verrouillage. */
type Datee = { created_at?: string | null }

/** Un seuil par mois, indexé « AAAA-MM » à l'heure de Paris.
 *
 *  Un seuil unique ne suffisait pas, et c'était une vraie fuite : il ne portait
 *  que sur le mois en cours, donc au 1ᵉʳ du mois suivant les réservations
 *  masquées de septembre étaient comparées au seuil d'octobre — antérieures,
 *  donc plus verrouillées. Téléphone, adresse et prix réapparaissaient en
 *  clair. Il suffisait d'attendre. Pire : une réservation prise fin septembre
 *  pour un rendez-vous début octobre livrait ses coordonnées AVANT le
 *  rendez-vous, qu'il suffisait alors d'honorer sans jamais payer.
 *
 *  Chaque réservation est désormais jugée sur le quota DE SON MOIS. Rien n'est
 *  écrit en base pour autant : le verrou reste un calcul, donc changer d'offre
 *  ouvre toujours tout d'un coup, sans migration ni rattrapage. */
export type SeuilsParMois = Record<string, string>

/** Le mois d'un instant, à l'heure de Paris, au format « AAAA-MM ».
 *
 *  À l'heure de Paris et pas en UTC : une réservation prise le 1ᵉʳ octobre à
 *  0 h 30 vaut « 2026-10 » en France et « 2026-09 » en UTC. Se tromper de mois
 *  la ferait juger sur le quota du mois précédent — déjà épuisé — et la
 *  masquerait à tort. */
export function moisParis(quand: string | null | undefined): string | null {
  if (!quand) return null
  const d = new Date(quand)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }).slice(0, 7)
}

/** Vrai si cette réservation est arrivée après l'épuisement du quota de SON
 *  mois.
 *
 *  La comparaison porte sur des instants, pas sur des chaînes : Postgres rend
 *  ses dates avec un nombre variable de décimales et un décalage explicite
 *  (`2026-09-24T10:37:06.323578+00:00`), deux écritures du même instant ne se
 *  comparent donc pas caractère par caractère. */
export function estVerrouillee(
  r: Datee | null | undefined,
  seuils: SeuilsParMois | null | undefined,
): boolean {
  if (!seuils || !r?.created_at) return false
  const mois = moisParis(r.created_at)
  if (!mois) return false
  const seuil = seuils[mois]
  if (!seuil) return false
  const t = new Date(r.created_at).getTime()
  const s = new Date(seuil).getTime()
  if (Number.isNaN(t) || Number.isNaN(s)) return false
  return t > s
}

/** Ce qu'une réservation verrouillée laisse voir, et ce qu'elle retient.
 *
 *  Le laveur garde LE NOM et LE JOUR. C'est assez pour savoir qu'un vrai
 *  client l'attend — donc pour avoir envie de le joindre — et trop peu pour le
 *  joindre. Tout masquer, nom compris, rendait la demande abstraite : une ligne
 *  « Réservation bloquée » ne donne envie de rien.
 *
 *  Ce qui part : le téléphone, l'email, l'adresse, le montant, le détail des
 *  véhicules, et L'HEURE. L'heure parce qu'elle suffit à honorer le rendez-vous
 *  sans rien payer — il suffirait d'attendre sur place.
 *
 *  Le masquage se fait ICI, au sortir de la base, et jamais dans les écrans :
 *  un composant qui oublierait la règle afficherait le vrai numéro. À cet
 *  endroit, l'oubli est impossible — la donnée n'existe déjà plus. */
const MASQUE = {
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

/** Le jour d'un rendez-vous, sans son heure, à l'heure de Paris.
 *
 *  Renvoyé à part plutôt qu'écrasé dans `scheduled_at` : la date complète sert
 *  encore au calcul des créneaux et à l'ordre d'affichage. La remplacer par un
 *  minuit ferait sauter le rendez-vous en tête de journée et fausserait les
 *  disponibilités. */
export function jourSeul(quand: string | null | undefined): string | null {
  if (!quand) return null
  const d = new Date(quand)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('fr-FR', {
    timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long',
  })
}

/** Remplace, dans une liste lue en base, tout ce qu'une réservation
 *  verrouillée ne doit pas laisser voir. */
export function masquerVerrouillees<T extends Datee>(
  reservations: T[],
  seuils: SeuilsParMois | null | undefined,
): (T & { verrouillee: boolean })[] {
  return reservations.map(r =>
    estVerrouillee(r, seuils)
      ? { ...r, ...MASQUE, verrouillee: true }
      : { ...r, verrouillee: false },
  )
}

/** Nombre de mois remontés pour calculer les seuils.
 *
 *  Une fenêtre, parce qu'une requête doit rester bornée. Au-delà, le masquage
 *  se lève : une réservation d'il y a plus d'un an n'a plus de valeur
 *  commerciale — le rendez-vous est passé depuis longtemps — et la garder
 *  verrouillée coûterait une requête plus lourde sur tous les écrans. C'est un
 *  arbitrage assumé, pas un oubli. */
const MOIS_COUVERTS = 12

/** Nombre de lignes lues au maximum. PostgREST plafonne de toute façon ses
 *  réponses ; l'écrire ici rend la limite visible. Un mois dont les lignes
 *  seraient tronquées n'obtient pas de seuil, donc ne masque rien : le doute
 *  profite au laveur, jamais l'inverse. */
const LIGNES_MAX = 5000

/** Un seuil de verrouillage par mois, sur la fenêtre couverte.
 *
 *  Le seuil d'un mois est la date de création de la DERNIÈRE réservation
 *  comprise dans le quota de ce mois-là. Un mois qui n'a pas atteint son
 *  plafond n'a pas de seuil, et rien n'y est masqué.
 *
 *  Une seule requête pour toute la fenêtre, et le classement se fait en
 *  mémoire : douze requêtes — une par mois — auraient coûté douze allers-retours
 *  sur chaque écran du tableau de bord.
 *
 *  Table vide quand l'offre n'a pas de plafond : il n'y a alors rien à masquer,
 *  et aucune requête n'est faite. */
export async function seuilsVerrouillage(
  // Le client Supabase n'est pas typé dans ce projet (voir washerCourant).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  washerId: string,
  quota: number | null,
  now: Date = new Date(),
): Promise<SeuilsParMois> {
  if (quota === null || quota <= 0) return {}

  // Début du mois courant, reculé de onze mois : douze mois complets, celui-ci
  // compris. Un jour de marge en plus absorbe le décalage d'heure d'été, qui
  // sinon pourrait manquer la première heure du mois le plus ancien.
  const borne = debutDuMoisParis(now)
  borne.setUTCMonth(borne.getUTCMonth() - (MOIS_COUVERTS - 1))
  borne.setUTCDate(borne.getUTCDate() - 1)

  const { data, error } = await supabase
    .from('bookings')
    .select('created_at')
    .eq('washer_id', washerId)
    .neq('status', 'cancelled')
    .gte('created_at', borne.toISOString())
    .order('created_at', { ascending: true })
    .limit(LIGNES_MAX)

  // Sans certitude, on ne masque rien : cacher les coordonnées d'un client à un
  // laveur qui y a droit lui ferait rater un vrai rendez-vous. Le sens du
  // doute va toujours vers le laveur.
  if (error || !data) return {}

  return seuilsDepuisDates(data.map((l: { created_at: string }) => l.created_at), quota)
}

/** Le classement lui-même, séparé de la base pour être vérifiable.
 *
 *  `dates` arrive triée par ordre croissant. Pour chaque mois, la N-ième
 *  réservation (N = quota) donne le seuil ; tout ce qui la suit dans le même
 *  mois est verrouillé. */
export function seuilsDepuisDates(dates: readonly string[], quota: number): SeuilsParMois {
  if (quota <= 0) return {}

  const compte: Record<string, number> = {}
  const seuils: SeuilsParMois = {}
  for (const d of dates) {
    const mois = moisParis(d)
    if (!mois) continue
    compte[mois] = (compte[mois] ?? 0) + 1
    if (compte[mois] === quota) seuils[mois] = d
  }
  return seuils
}

/** Combien de réservations ce mois-ci, plafond compris.
 *
 *  Sert à choisir l'offre à proposer : c'est ce volume-là qu'elle doit couvrir.
 *  Le compte porte sur les mêmes lignes que `seuilsVerrouillage` — même mois,
 *  mêmes annulations écartées — sinon les deux se contrediraient.
 *
 *  `null` en cas d'erreur, et jamais zéro : un zéro inventé ferait proposer la
 *  plus petite offre à quelqu'un qui en déborde. */
export async function compterReservationsDuMois(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  washerId: string,
  now: Date = new Date(),
): Promise<number | null> {
  const { count, error } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('washer_id', washerId)
    .neq('status', 'cancelled')
    .gte('created_at', debutDuMoisParis(now).toISOString())

  if (error || count === null || count === undefined) return null
  return count
}

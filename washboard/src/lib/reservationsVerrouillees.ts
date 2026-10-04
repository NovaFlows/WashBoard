import type { SupabaseClient } from '@supabase/supabase-js'
import {
  debutPeriodeQuota, finPeriodeQuota, debutSoumisAuPlafond, PLAFOND_RESERVATIONS_APPLIQUE_DES,
} from '@/lib/plan'
import { logger } from '@/lib/logger'

// Réservations au-delà du quota mensuel : le client réserve, le laveur ne voit
// rien.
//
// Le plafond de l'offre gratuite refusait la réservation. Le client repartait,
// et c'est LUI qui payait la limite d'un logiciel qu'il n'a pas choisi — le
// laveur perdait un lavage sans même savoir qu'on l'avait sollicité.
//
// Désormais la réservation est enregistrée normalement. Ce qui est plafonné,
// c'est ce que le laveur en VOIT : au-delà de son quota, il connaît LE JOUR,
// rien d'autre. Assez pour savoir qu'un vrai client l'attend, trop peu pour
// savoir lequel, le joindre ou honorer le rendez-vous sans rien payer.
// La pression change de camp : elle pèse sur celui qui peut y remédier.
//
// Rien n'est écrit en base pour marquer ces réservations, et c'est voulu : le
// verrouillage se DÉDUIT du quota en cours. Le jour où le laveur change
// d'offre, tout ce qui était masqué s'ouvre d'un coup, sans migration ni
// rattrapage. Une colonne aurait figé une décision qui doit pouvoir changer.

/** Réservation minimale pour décider du verrouillage.
 *
 *  `saisie_par_laveur` : posée quand le laveur a lui-même saisi le rendez-vous dans son agenda
 *  (un client trouvé de son côté). Ce client n'est pas venu par WashBoard : il n'y a rien à
 *  débloquer, donc jamais masqué et jamais compté dans le quota. */
type Datee = { created_at?: string | null; saisie_par_laveur?: boolean | null; facture_numero?: string | null }

/** Une période de quota, et l'instant après lequel tout y est verrouillé.
 *
 *  Une période, pas un mois calendaire : le compteur repart à la date
 *  anniversaire de l'inscription (voir `debutPeriodeQuota`). Un laveur inscrit
 *  le 22 a son mois du 22 au 21.
 *
 *  Les bornes sont portées ici plutôt que recalculées à chaque appel : une
 *  réservation appartient à la période qui la contient, et `estVerrouillee`
 *  n'a donc besoin de rien d'autre que cette liste — ni de la date
 *  d'inscription, ni du jour d'ancrage. Ce qui évite de faire descendre la
 *  fiche du laveur jusque dans les composants d'affichage.
 *
 *  Un seuil unique ne suffisait pas, et c'était une vraie fuite : il ne portait
 *  que sur la période en cours, donc au changement de période tout ce qui était
 *  masqué redevenait lisible. Téléphone, adresse et prix réapparaissaient en
 *  clair. Il suffisait d'attendre. */
export type Periode = {
  /** Début inclus, instant ISO. */
  debut: string
  /** Fin exclue : c'est le début de la période suivante. */
  fin: string
  /** Création de la DERNIÈRE réservation comprise dans le quota. */
  seuil: string
}

export type SeuilsVerrouillage = readonly Periode[]

/** La période qui contient cet instant, s'il y en a une. */
function periodeDe(quand: string, periodes: SeuilsVerrouillage): Periode | null {
  const t = new Date(quand).getTime()
  if (Number.isNaN(t)) return null
  for (const p of periodes) {
    if (t >= new Date(p.debut).getTime() && t < new Date(p.fin).getTime()) return p
  }
  return null
}

/** Vrai si cette réservation est arrivée après l'épuisement du quota de SA
 *  période.
 *
 *  La comparaison porte sur des instants, pas sur des chaînes : Postgres rend
 *  ses dates avec un nombre variable de décimales et un décalage explicite
 *  (`2026-09-24T10:37:06.323578+00:00`), deux écritures du même instant ne se
 *  comparent donc pas caractère par caractère. */
export function estVerrouillee(
  r: Datee | null | undefined,
  periodes: SeuilsVerrouillage | null | undefined,
): boolean {
  if (!periodes || periodes.length === 0 || !r?.created_at) return false
  if (r.saisie_par_laveur) return false
  // Décision `legal` du 2026-10-04 : une facture déjà émise garantit un accès
  // intégral, partout — pas seulement sur la route PDF (voir son exception
  // dédiée). Un laveur qui redescend d'offre voit son plafond, plus bas,
  // s'appliquer rétroactivement sur 12 périodes passées ; sans cette sortie,
  // une réservation déjà facturée (donc potentiellement déjà réglée par le
  // client) se retrouvait re-masquée après coup, au mépris de l'obligation
  // de conservation des factures du laveur et sans justification commerciale
  // (le masquage n'a de sens qu'AVANT facturation, pour inciter à upgrader).
  if (r.facture_numero) return false

  // Le plafond ne vaut que pour l'avenir. Les clients que le laveur avait
  // AVANT restent à lui : il les a lavés, appelés, facturés. Deuxième garde-fou
  // après celui de `seuilsVerrouillage`, qui ne compte déjà rien d'antérieur :
  // ce qui est masqué doit l'être par deux chemins, jamais par un seul oubli.
  const arrivee = new Date(r.created_at).getTime()
  const entree = new Date(PLAFOND_RESERVATIONS_APPLIQUE_DES).getTime()
  if (Number.isNaN(arrivee)) return false
  if (!Number.isNaN(entree) && arrivee < entree) return false

  const p = periodeDe(r.created_at, periodes)
  if (!p) return false
  const s = new Date(p.seuil).getTime()
  if (Number.isNaN(s)) return false
  return arrivee > s
}

/** Ce qu'une réservation verrouillée laisse voir, et ce qu'elle retient.
 *
 *  Le laveur garde LE JOUR, et rien d'autre.
 *
 *  LE NOM part aussi (décision de Ryan, 2026-10-02). Il était resté visible
 *  parce qu'il rendait la demande concrète, mais un nom suffit à contourner le
 *  verrouillage : un client déjà servi, un voisin, une connaissance — le
 *  laveur le reconnaît et l'appelle avec son propre carnet, sans jamais payer.
 *  Le masquage ne vaut que s'il ne laisse rien qui identifie la personne.
 *
 *  Ce qui part encore : le téléphone, l'email, l'adresse, le montant, le
 *  détail des véhicules, et L'HEURE (début ET fin). L'heure parce qu'elle
 *  suffit à honorer le rendez-vous sans rien payer — il suffirait d'attendre
 *  sur place. La position GPS et les frais de déplacement partent aussi :
 *  tous deux trahiraient l'adresse déjà masquée, en clair ou par recoupement.
 *
 *  Le masquage se fait ICI, au sortir de la base, et jamais dans les écrans :
 *  un composant qui oublierait la règle afficherait le vrai numéro. À cet
 *  endroit, l'oubli est impossible — la donnée n'existe déjà plus. */
const MASQUE = {
  client_name: null,
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
  // Trois oublis trouvés le 2026-10-02 (vérification Playwright en conditions réelles) :
  // `ends_at` combinée à la durée de la prestation (déjà visible) permet de recalculer l'heure
  // de début malgré le masquage de `scheduled_at` dans les écrans qui le tronquent ; `lat`/`lng`
  // sont l'équivalent exact de l'adresse déjà masquée ; `travel_fee` donne une idée de la
  // distance au client, donc indirectement d'où il habite.
  ends_at: null,
  lat: null,
  lng: null,
  travel_fee: null,
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
  periodes: SeuilsVerrouillage | null | undefined,
): (T & { verrouillee: boolean })[] {
  return reservations.map(r =>
    estVerrouillee(r, periodes)
      ? { ...r, ...MASQUE, verrouillee: true }
      : { ...r, verrouillee: false },
  )
}

/** Nombre de périodes remontées pour calculer les seuils.
 *
 *  Une fenêtre, parce qu'une requête doit rester bornée. Au-delà, le masquage
 *  se lève : une réservation d'il y a plus d'un an n'a plus de valeur
 *  commerciale — le rendez-vous est passé depuis longtemps — et la garder
 *  verrouillée coûterait une requête plus lourde sur tous les écrans. C'est un
 *  arbitrage assumé, pas un oubli. */
const PERIODES_COUVERTES = 12

/** Nombre de lignes lues au maximum. PostgREST plafonne de toute façon ses
 *  réponses ; l'écrire ici rend la limite visible. Une période dont les lignes
 *  seraient tronquées n'obtient pas de seuil, donc ne masque rien : le doute
 *  profite au laveur, jamais l'inverse. */
const LIGNES_MAX = 5000

/** Ce qu'il faut savoir du laveur pour découper ses périodes. */
export type LaveurPeriode = { id: string; created_at?: string | null }

/** Les bornes des périodes couvertes, de la plus ancienne à la plus récente. */
export function bornesPeriodes(
  creeLe: string | null | undefined,
  now: Date = new Date(),
  combien: number = PERIODES_COUVERTES,
): { debut: string; fin: string }[] {
  const bornes: { debut: string; fin: string }[] = []
  let curseur = now
  for (let i = 0; i < combien; i++) {
    const debut = debutPeriodeQuota(creeLe, curseur)
    const fin = finPeriodeQuota(creeLe, curseur)
    bornes.unshift({ debut: debut.toISOString(), fin: fin.toISOString() })
    // Une milliseconde avant ce début tombe dans la période précédente.
    curseur = new Date(debut.getTime() - 1)
  }
  return bornes
}

/** Un seuil de verrouillage par période, sur la fenêtre couverte.
 *
 *  Le seuil d'une période est la date de création de la DERNIÈRE réservation
 *  comprise dans le quota de cette période-là. Une période qui n'a pas atteint
 *  son plafond n'a pas de seuil, et rien n'y est masqué.
 *
 *  Une seule requête pour toute la fenêtre, et le classement se fait en
 *  mémoire : douze requêtes — une par période — auraient coûté douze
 *  allers-retours sur chaque écran du tableau de bord.
 *
 *  Liste vide quand l'offre n'a pas de plafond : il n'y a alors rien à masquer,
 *  et aucune requête n'est faite. */
export async function seuilsVerrouillage(
  // Client ADMIN, jamais celui de la session : le rôle `authenticated` ne doit
  // plus lire `bookings` (un laveur l'interrogeait en direct, masque compris).
  // Avec une session, cette lecture échouerait — et un échec ne masque rien :
  // tout partirait en clair sur l'écran appelant.
  // Le client Supabase n'est pas typé dans ce projet (voir washerCourant).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, any, any>,
  laveur: LaveurPeriode,
  quota: number | null,
  now: Date = new Date(),
): Promise<SeuilsVerrouillage> {
  if (quota === null || quota <= 0) return []

  const bornes = bornesPeriodes(laveur.created_at, now)
  if (bornes.length === 0) return []

  // Jamais avant l'entrée en vigueur du plafond : les réservations antérieures
  // ne sont ni masquées, ni même COMPTÉES dans le quota de leur période. Sinon
  // la période du déploiement serait déjà pleine avant d'avoir commencé, et le
  // premier client d'après se retrouverait caché sans raison.
  const depart = debutSoumisAuPlafond(new Date(bornes[0].debut))

  const { data, error } = await admin
    .from('bookings')
    .select('created_at')
    .eq('washer_id', laveur.id)
    .neq('status', 'cancelled')
    .eq('saisie_par_laveur', false)
    .gte('created_at', depart.toISOString())
    .order('created_at', { ascending: true })
    .limit(LIGNES_MAX)

  // Sans certitude, on ne masque rien : cacher les coordonnées d'un client à un
  // laveur qui y a droit lui ferait rater un vrai rendez-vous. Le sens du
  // doute va toujours vers le laveur. Mais ce repli lève le masquage de tout
  // l'écran : il ne doit jamais passer inaperçu.
  if (error || !data) {
    logger.error('verrouillage.seuils.read_failed', { washerId: laveur.id }, error)
    return []
  }

  return seuilsDepuisDates(data.map((l: { created_at: string }) => l.created_at), quota, bornes)
}

/** Le classement lui-même, séparé de la base pour être vérifiable.
 *
 *  `dates` arrive triée par ordre croissant. Dans chaque période, la N-ième
 *  réservation (N = quota) donne le seuil ; tout ce qui la suit dans la même
 *  période est verrouillé. */
export function seuilsDepuisDates(
  dates: readonly string[],
  quota: number,
  bornes: readonly { debut: string; fin: string }[],
): SeuilsVerrouillage {
  if (quota <= 0 || bornes.length === 0) return []

  const compte = new Map<string, number>()
  const seuils = new Map<string, string>()
  for (const d of dates) {
    const t = new Date(d).getTime()
    if (Number.isNaN(t)) continue
    const b = bornes.find(x => t >= new Date(x.debut).getTime() && t < new Date(x.fin).getTime())
    if (!b) continue
    const n = (compte.get(b.debut) ?? 0) + 1
    compte.set(b.debut, n)
    if (n === quota) seuils.set(b.debut, d)
  }

  const trouves: Periode[] = []
  for (const b of bornes) {
    const seuil = seuils.get(b.debut)
    if (seuil) trouves.push({ debut: b.debut, fin: b.fin, seuil })
  }
  return trouves
}

/** Combien de réservations dans la période en cours, plafond compris.
 *
 *  Sert à la jauge, au choix de l'offre à proposer et au retrait du bouton
 *  WhatsApp. Le compte porte sur les mêmes lignes que `seuilsVerrouillage` —
 *  même période, mêmes annulations écartées — sinon les deux se
 *  contrediraient.
 *
 *  `null` en cas d'erreur, et jamais zéro : un zéro inventé ferait proposer la
 *  plus petite offre à quelqu'un qui en déborde. */
export async function compterReservationsDeLaPeriode(
  // Client admin, pour la même raison que `seuilsVerrouillage`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, any, any>,
  laveur: LaveurPeriode,
  now: Date = new Date(),
): Promise<number | null> {
  const { count, error } = await admin
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('washer_id', laveur.id)
    .neq('status', 'cancelled')
    .eq('saisie_par_laveur', false)
    .gte('created_at', debutSoumisAuPlafond(debutPeriodeQuota(laveur.created_at, now)).toISOString())

  if (error || count === null || count === undefined) {
    logger.warn('verrouillage.compte_periode.read_failed', { washerId: laveur.id }, error)
    return null
  }
  return count
}

/** Ce que les réservations verrouillées représentent en euros.
 *
 *  « 3 nouveaux clients en attente » ne dit rien à un laveur : il compte des
 *  lavages, pas des lignes. « 195 € que vous ne voyez pas » se comprend sans
 *  réfléchir, et se compare tout seul aux 19 € ou 49 € de l'abonnement. C'est
 *  le même fait, dans la langue de celui qui le lit.
 *
 *  Le calcul se fait sur la liste BRUTE, avant masquage : `masquerVerrouillees`
 *  efface justement `booked_price`. On somme donc ici, puis on masque.
 *
 *  Le prix retenu est celui effectivement réservé ; à défaut, celui de la
 *  prestation. Une réservation sans prix connu compte pour zéro plutôt que de
 *  faire échouer le total : mieux vaut annoncer un montant prudent qu'un
 *  montant faux — un chiffre gonflé qui se dégonfle au paiement, c'est la
 *  confiance qui part avec. */
type Chiffree = Datee & {
  booked_price?: number | null
  services?: { price?: number | null } | { price?: number | null }[] | null
}

export function montantVerrouille(
  reservations: readonly Chiffree[],
  periodes: SeuilsVerrouillage | null | undefined,
): number {
  let total = 0
  for (const r of reservations) {
    if (!estVerrouillee(r, periodes)) continue
    const service = Array.isArray(r.services) ? r.services[0] : r.services
    const prix = r.booked_price ?? service?.price ?? 0
    if (typeof prix === 'number' && Number.isFinite(prix)) total += prix
  }
  return total
}

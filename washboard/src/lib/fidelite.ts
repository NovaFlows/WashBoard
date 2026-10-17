import { z } from 'zod'
import { EMBLEMES_CARTE, FINITIONS_CARTE } from '@/lib/carteFidelite'

// Carte de fidélité (décisions d'Alexandre, 2026-10-17) :
// - des TAMPONS : une prestation terminée = un tampon ; après N tampons (choisi par le
//   laveur), la réservation suivante reçoit la récompense ;
// - la récompense, au choix du laveur : prestation offerte, remise en %, remise en € —
//   appliquée AUTOMATIQUEMENT et recalculée par le serveur (`api/bookings`), comme les
//   promotions ;
// - le client voit sa carte sur une page personnelle (lien dans ses emails), et sur la page
//   de réservation une fois ses coordonnées tapées — jamais selon l'appareil ;
// - un tampon compte quand le laveur marque le rendez-vous « Terminé » ; une annulation ne
//   compte jamais ; le laveur peut ajouter ou retirer un tampon à la main.
//
// Rien n'est stocké tampon par tampon : la carte se RECALCULE à partir des réservations du
// client (même identification que le reste du CRM, `cleClient` : email, à défaut téléphone),
// plus l'ajustement manuel du laveur. Une réservation corrigée ou annulée après coup met donc
// la carte à jour d'elle-même.

export const TAMPONS_PROPOSES = [5, 8, 10, 12] as const
export const TYPES_RECOMPENSE = ['offerte', 'pourcentage', 'montant'] as const
export type TypeRecompense = (typeof TYPES_RECOMPENSE)[number]

export const ReglagesFideliteSchema = z.object({
  actif: z.boolean(),
  tampons: z.number().int().min(2, 'Au moins 2 tampons.').max(30, 'Au plus 30 tampons.'),
  recompense: z.enum(TYPES_RECOMPENSE),
  /** Remise en % ou en € ; ignorée pour une prestation offerte. */
  valeur: z.number().min(0).max(10_000),
  /** Prestation offerte : les options et les frais de déplacement le sont-ils aussi ?
   *  (demande d'Alexandre, 2026-10-17 : au choix du laveur). Ignorés pour une remise. */
  offre_options: z.boolean().optional().default(true),
  offre_deplacement: z.boolean().optional().default(false),
  /** Apparence de la carte (lib/carteFidelite.ts). Couleur absente : celle de marque du laveur. */
  couleur: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur invalide.').optional(),
  finition: z.enum(FINITIONS_CARTE).optional().default('holo'),
  /** Logo ou initiale sur la carte ; absent : le logo s'il y en a un. */
  embleme: z.enum(EMBLEMES_CARTE).optional(),
}).superRefine((r, ctx) => {
  if (r.recompense === 'pourcentage' && !(r.valeur > 0 && r.valeur <= 100)) {
    ctx.addIssue({ code: 'custom', path: ['valeur'], message: 'Une remise en pourcentage va de 1 à 100 %.' })
  }
  if (r.recompense === 'montant' && !(r.valeur > 0)) {
    ctx.addIssue({ code: 'custom', path: ['valeur'], message: 'Indiquez le montant de la remise.' })
  }
})
export type ReglagesFidelite = z.infer<typeof ReglagesFideliteSchema>

/** Les réglages enregistrés, s'ils sont valides ET actifs ; sinon `null` (pas de carte). */
export function fideliteActive(brut: unknown): ReglagesFidelite | null {
  const r = ReglagesFideliteSchema.safeParse(brut)
  return r.success && r.data.actif ? r.data : null
}

export type ReservationCarte = { status: string; fidelite_remise?: number | null }

export type EtatCarte = {
  /** Tampons gagnés depuis le début (prestations terminées + ajustement du laveur). */
  total: number
  /** Tampons sur la carte en cours (0 à N−1). */
  progression: number
  requis: number
  /** Récompenses gagnées et pas encore utilisées. */
  disponibles: number
}

export function etatCarte(reservations: readonly ReservationCarte[], ajustement: number, requis: number): EtatCarte {
  const terminees = reservations.filter(r => r.status === 'done').length
  const total = Math.max(0, terminees + ajustement)
  // Une récompense est « utilisée » par une réservation qui l'a reçue et n'a pas été annulée :
  // annuler rend la récompense, comme si elle n'avait pas servi.
  const utilisees = reservations.filter(r => r.status !== 'cancelled' && Number(r.fidelite_remise ?? 0) > 0).length
  return {
    total,
    progression: total % requis,
    requis,
    disponibles: Math.max(0, Math.floor(total / requis) - utilisees),
  }
}

/** Ce que coûte la réservation, découpé comme la récompense le demande. `prestation` et
 *  `options` sont après promotion ; `deplacement` est le frais de déplacement. */
export type PrixReservation = { prestation: number; options: number; deplacement: number }

/** Remise en euros de la récompense, arrondie au centime, jamais négative.
 *  - prestation offerte : la prestation, plus les options et/ou le déplacement si le laveur
 *    les offre aussi ;
 *  - remise en % ou en € : sur la prestation et ses options, jamais sur le déplacement. */
export function remiseFidelite(r: Pick<ReglagesFidelite, 'recompense' | 'valeur'> & Partial<Pick<ReglagesFidelite, 'offre_options' | 'offre_deplacement'>>, prix: PrixReservation): number {
  const prestation = Math.max(0, prix.prestation)
  const options = Math.max(0, prix.options)
  const deplacement = Math.max(0, prix.deplacement)
  let brute: number
  if (r.recompense === 'offerte') {
    brute = prestation + (r.offre_options !== false ? options : 0) + (r.offre_deplacement ? deplacement : 0)
  } else {
    const base = prestation + options
    brute = Math.min(base, r.recompense === 'pourcentage' ? base * r.valeur / 100 : r.valeur)
  }
  return Math.round(Math.max(brute, 0) * 100) / 100
}

/** Ce qui est offert, en toutes lettres (« la prestation, les options et le déplacement »). */
export function partiesOffertes(r: Partial<Pick<ReglagesFidelite, 'offre_options' | 'offre_deplacement'>>): string {
  const parties = ['la prestation']
  if (r.offre_options !== false) parties.push('les options')
  if (r.offre_deplacement) parties.push('le déplacement')
  return parties.length === 1 ? parties[0] : `${parties.slice(0, -1).join(', ')} et ${parties[parties.length - 1]}`
}

/** « Prestation offerte », « −20 % », « −15 € ». */
export function libelleRecompense(r: Pick<ReglagesFidelite, 'recompense' | 'valeur'> & Partial<Pick<ReglagesFidelite, 'offre_options' | 'offre_deplacement'>>): string {
  if (r.recompense === 'offerte') {
    const extra = [r.offre_options !== false ? 'options' : null, r.offre_deplacement ? 'déplacement' : null].filter(Boolean)
    return extra.length ? `une prestation offerte (${extra.join(' et ')} compris)` : 'une prestation offerte'
  }
  const v = Number.isInteger(r.valeur) ? String(r.valeur) : r.valeur.toFixed(2).replace('.', ',')
  return r.recompense === 'pourcentage' ? `−${v} % sur une prestation` : `−${v} € sur une prestation`
}

/** La récompense en deux mots, pour le recto de la carte : « Prestation offerte », « −20 % ». */
export function recompenseCourte(r: Pick<ReglagesFidelite, 'recompense' | 'valeur'>): string {
  if (r.recompense === 'offerte') return 'Prestation offerte'
  const v = Number.isInteger(r.valeur) ? String(r.valeur) : r.valeur.toFixed(2).replace('.', ',')
  return r.recompense === 'pourcentage' ? `−${v} %` : `−${v} €`
}

/** La phrase que lit le client sous sa carte. */
export function phraseCarte(e: EtatCarte, r: Pick<ReglagesFidelite, 'recompense' | 'valeur'> & Partial<Pick<ReglagesFidelite, 'offre_options' | 'offre_deplacement'>>): string {
  if (e.disponibles > 0) return `Récompense débloquée : ${libelleRecompense(r)}, appliquée automatiquement à votre prochaine réservation.`
  const reste = e.requis - e.progression
  return `Plus que ${reste} prestation${reste > 1 ? 's' : ''} avant ${libelleRecompense(r)}.`
}

/** Jeton de la page carte (`/fidelite/<jeton>`) : assez long pour ne pas se deviner. */
export function nouveauJeton(): string {
  const octets = new Uint8Array(18)
  crypto.getRandomValues(octets)
  return Array.from(octets, o => o.toString(16).padStart(2, '0')).join('')
}

export function jetonValide(j: unknown): j is string {
  return typeof j === 'string' && /^[0-9a-f]{36}$/.test(j)
}

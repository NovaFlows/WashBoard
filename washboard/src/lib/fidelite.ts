import { z } from 'zod'

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

/** Remise en euros de la récompense sur un prix de prestation (options comprises), arrondie
 *  au centime, jamais plus que le prix. */
export function remiseFidelite(r: Pick<ReglagesFidelite, 'recompense' | 'valeur'>, prix: number): number {
  if (!(prix > 0)) return 0
  const brute = r.recompense === 'offerte' ? prix : r.recompense === 'pourcentage' ? prix * r.valeur / 100 : r.valeur
  return Math.round(Math.min(Math.max(brute, 0), prix) * 100) / 100
}

/** « Prestation offerte », « −20 % », « −15 € ». */
export function libelleRecompense(r: Pick<ReglagesFidelite, 'recompense' | 'valeur'>): string {
  if (r.recompense === 'offerte') return 'une prestation offerte'
  const v = Number.isInteger(r.valeur) ? String(r.valeur) : r.valeur.toFixed(2).replace('.', ',')
  return r.recompense === 'pourcentage' ? `−${v} % sur une prestation` : `−${v} € sur une prestation`
}

/** La phrase que lit le client sous sa carte. */
export function phraseCarte(e: EtatCarte, r: Pick<ReglagesFidelite, 'recompense' | 'valeur'>): string {
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

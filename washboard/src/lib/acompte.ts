import { z } from 'zod'

// Acompte à la réservation (décisions d'Alexandre, 2026-10-17) — « option 1 » : l'argent
// passe par le LIEN DE PAIEMENT DU LAVEUR (SumUp, PayPal, Lydia, lien Stripe à lui…), jamais
// par WashBoard. Encaisser pour le compte d'un tiers est réservé aux établissements de
// paiement agréés : WashBoard affiche le montant et le lien, le laveur confirme la réception.
//
// Tout est au choix du laveur :
// - l'acompte lui-même (actif ou non) ;
// - son montant, fixe en euros ou en pourcentage du total ;
// - le délai pour le payer, au-delà duquel la réservation s'annule seule (ou jamais) ;
// - le remboursement en cas d'annulation par le client, ANNONCÉ au client avant qu'il
//   réserve (`conditionsAcompte`).
//
// Ce fichier ne touche ni base ni écran : la même règle sert à la page de réservation, à
// l'enregistrement (`api/bookings`) et aux réglages.

export const TYPES_ACOMPTE = ['pourcentage', 'montant'] as const
export type TypeAcompte = (typeof TYPES_ACOMPTE)[number]

/** Délais proposés pour payer l'acompte, en heures. `null` : pas d'annulation automatique. */
export const DELAIS_PAIEMENT = [2, 12, 24, 48] as const
/** Délais proposés pour annuler en étant remboursé, en heures avant le rendez-vous. */
export const DELAIS_REMBOURSEMENT = [24, 48, 72] as const

function lienValide(lien: string): boolean {
  try {
    return new URL(lien).protocol === 'https:'
  } catch {
    return false
  }
}

export const ReglagesAcompteSchema = z.object({
  actif: z.boolean(),
  type: z.enum(TYPES_ACOMPTE),
  valeur: z.number().positive('Indiquez le montant de l’acompte.'),
  /** Lien de paiement du laveur. Exigé seulement quand l'acompte est actif. */
  lien: z.string().trim().max(500),
  /** Heures pour payer avant annulation automatique ; `null` = jamais annulée. */
  delai_heures: z.number().int().positive().max(168).nullable(),
  remboursable: z.boolean(),
  /** Remboursé si le client annule au moins N heures avant le rendez-vous. */
  remboursement_heures: z.number().int().positive().max(720).nullable(),
}).superRefine((r, ctx) => {
  if (r.actif && !lienValide(r.lien)) {
    ctx.addIssue({ code: 'custom', path: ['lien'], message: 'Collez votre lien de paiement complet, qui commence par https://' })
  }
  if (r.type === 'pourcentage' && r.valeur > 100) {
    ctx.addIssue({ code: 'custom', path: ['valeur'], message: 'Un acompte ne peut pas dépasser 100 % du prix.' })
  }
  if (r.remboursable && !r.remboursement_heures) {
    ctx.addIssue({ code: 'custom', path: ['remboursement_heures'], message: 'Choisissez jusqu’à quand l’acompte est remboursé.' })
  }
})
export type ReglagesAcompte = z.infer<typeof ReglagesAcompteSchema>

/** Les réglages enregistrés, s'ils sont valides ET actifs ; sinon `null` (pas d'acompte).
 *  Une valeur abîmée en base ne doit jamais bloquer une réservation. */
export function acompteActif(brut: unknown): ReglagesAcompte | null {
  const r = ReglagesAcompteSchema.safeParse(brut)
  return r.success && r.data.actif ? r.data : null
}

/** Montant de l'acompte pour un total donné, arrondi au centime, jamais plus que le total. */
export function montantAcompte(r: Pick<ReglagesAcompte, 'type' | 'valeur'>, total: number): number {
  if (!(total > 0)) return 0
  const brut = r.type === 'pourcentage' ? total * r.valeur / 100 : r.valeur
  return Math.round(Math.min(Math.max(brut, 0), total) * 100) / 100
}

/** Date limite de paiement, ou `null` si la réservation n'est jamais annulée faute d'acompte. */
export function echeanceAcompte(r: Pick<ReglagesAcompte, 'delai_heures'>, depuis: Date = new Date()): string | null {
  return r.delai_heures ? new Date(depuis.getTime() + r.delai_heures * 3600_000).toISOString() : null
}

function heures(h: number): string {
  return h > 48 && h % 24 === 0 ? `${h / 24} jours` : `${h} h`
}

/** Les conditions lues par le client AVANT de réserver, puis rappelées après. */
export function conditionsAcompte(r: Pick<ReglagesAcompte, 'delai_heures' | 'remboursable' | 'remboursement_heures'>): string[] {
  const lignes: string[] = []
  lignes.push(r.delai_heures
    ? `À régler dans les ${heures(r.delai_heures)} après la réservation, sinon elle est annulée.`
    : 'À régler après la réservation, avec le lien de paiement.')
  lignes.push(r.remboursable && r.remboursement_heures
    ? `Remboursé si vous annulez au moins ${heures(r.remboursement_heures)} avant le rendez-vous.`
    : 'Non remboursable en cas d’annulation de votre part.')
  lignes.push('Le reste se règle sur place.')
  return lignes
}

/** Ce que la page publique reçoit des réglages : tout sauf l'interrupteur. */
export type AcomptePublic = Omit<ReglagesAcompte, 'actif'>

export function versPublic(r: ReglagesAcompte): AcomptePublic {
  const { actif: _actif, ...reste } = r
  return reste
}

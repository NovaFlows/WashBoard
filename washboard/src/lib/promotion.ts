import { z } from 'zod'

// Promotions temporaires (demande d'Alexandre, 2026-10-17) : le laveur annonce une remise
// pendant une période — Saint-Valentin, rentrée, fête des mères — et peut afficher sur sa
// page de réservation un bandeau qu'il règle lui-même (texte, couleur, compte à rebours).
//
// Ce fichier ne touche ni base ni écran : la règle de calcul est vérifiable ligne à ligne,
// et c'est la MÊME qui sert à la page (affichage) et à l'enregistrement d'une réservation
// (`api/bookings`, qui recalcule tout et ignore ce que le navigateur envoie).
//
// Choix faits :
// - la promotion s'applique aux réservations PRISES pendant la période (date du jour), pas
//   aux rendez-vous qui tombent dedans : c'est ce qu'annonce un compte à rebours ;
// - la remise porte sur la prestation et ses options, jamais sur les frais de déplacement ;
// - une seule promotion active à la fois : deux périodes ne peuvent pas se chevaucher.

export const TYPES_REMISE = ['pourcentage', 'montant'] as const
export type TypeRemise = (typeof TYPES_REMISE)[number]

/** Couleurs proposées pour le bandeau. Le laveur peut aussi saisir la sienne. */
export const COULEURS_BANDEAU = ['#16161A', '#B3261E', '#C2185B', '#9A5B00', '#127A4B', '#306090'] as const

export type Promotion = {
  id: string
  nom: string
  type_remise: TypeRemise
  valeur: number
  debut: string
  fin: string
  /** Prestations concernées ; vide ou nul = toutes. */
  service_ids: string[] | null
  bandeau_actif: boolean
  bandeau_texte: string | null
  bandeau_couleur: string | null
  bandeau_compteur: boolean
}

/** Ce que la page publique reçoit : rien d'autre ne part vers le navigateur du client. */
export type PromotionPublique = Pick<Promotion, 'nom' | 'type_remise' | 'valeur' | 'fin' | 'service_ids' | 'bandeau_actif' | 'bandeau_texte' | 'bandeau_couleur' | 'bandeau_compteur'>

const COULEUR = /^#[0-9a-fA-F]{6}$/

export const PromotionSaisieSchema = z.object({
  nom: z.string().trim().min(1, 'Donnez un nom à la promotion.').max(60, 'Le nom fait 60 caractères au maximum.'),
  type_remise: z.enum(TYPES_REMISE),
  valeur: z.number().positive('La remise doit être supérieure à zéro.'),
  debut: z.string().datetime({ offset: true }),
  fin: z.string().datetime({ offset: true }),
  service_ids: z.array(z.string().uuid()).max(200).nullable().optional(),
  bandeau_actif: z.boolean().default(true),
  bandeau_texte: z.string().trim().max(140, 'Le texte du bandeau fait 140 caractères au maximum.').nullable().optional(),
  bandeau_couleur: z.string().regex(COULEUR, 'Couleur invalide.').nullable().optional(),
  bandeau_compteur: z.boolean().default(true),
}).superRefine((p, ctx) => {
  if (p.type_remise === 'pourcentage' && p.valeur > 90) {
    ctx.addIssue({ code: 'custom', path: ['valeur'], message: 'Une remise en pourcentage ne peut pas dépasser 90 %.' })
  }
  if (new Date(p.fin).getTime() <= new Date(p.debut).getTime()) {
    ctx.addIssue({ code: 'custom', path: ['fin'], message: 'La fin doit être après le début.' })
  }
})
export type PromotionSaisie = z.infer<typeof PromotionSaisieSchema>

/** Deux périodes se chevauchent-elles ? (bornes de fin exclues) */
export function chevauche(a: { debut: string; fin: string }, b: { debut: string; fin: string }): boolean {
  return new Date(a.debut).getTime() < new Date(b.fin).getTime()
    && new Date(b.debut).getTime() < new Date(a.fin).getTime()
}

/** La promotion en cours à `maintenant`, s'il y en a une. */
export function promotionActive<T extends { debut: string; fin: string }>(promotions: readonly T[], maintenant: Date = new Date()): T | null {
  const t = maintenant.getTime()
  return promotions.find(p => new Date(p.debut).getTime() <= t && t < new Date(p.fin).getTime()) ?? null
}

export function concerne(promo: Pick<Promotion, 'service_ids'>, serviceId: string | null | undefined): boolean {
  if (!serviceId) return false
  return !promo.service_ids?.length || promo.service_ids.includes(serviceId)
}

/** Remise en euros sur un prix de prestation (options comprises), arrondie au centime.
 *  Jamais négative, jamais plus que le prix. */
export function remisePromotion(
  promo: Pick<Promotion, 'type_remise' | 'valeur' | 'service_ids'> | null | undefined,
  serviceId: string | null | undefined,
  prix: number,
): number {
  if (!promo || !concerne(promo, serviceId) || !(prix > 0)) return 0
  const brute = promo.type_remise === 'pourcentage' ? prix * promo.valeur / 100 : promo.valeur
  return Math.round(Math.min(Math.max(brute, 0), prix) * 100) / 100
}

/** « −20 % » ou « −15 € », pour le bandeau et les prix barrés. */
export function libelleRemise(promo: Pick<Promotion, 'type_remise' | 'valeur'>): string {
  const v = Number.isInteger(promo.valeur) ? String(promo.valeur) : promo.valeur.toFixed(2).replace('.', ',')
  return promo.type_remise === 'pourcentage' ? `−${v} %` : `−${v} €`
}

/** Texte lisible sur la couleur de fond choisie : noir sur fond clair, blanc sur fond foncé. */
export function couleurTexteSur(fond: string): '#FFFFFF' | '#16161A' {
  if (!COULEUR.test(fond)) return '#FFFFFF'
  const [r, g, b] = [1, 3, 5].map(i => parseInt(fond.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance > 0.4 ? '#16161A' : '#FFFFFF'
}

/** Temps restant découpé pour le compte à rebours. `null` une fois la fin passée. */
export function tempsRestant(fin: string, maintenant: Date = new Date()): { jours: number; heures: number; minutes: number; secondes: number } | null {
  const ms = new Date(fin).getTime() - maintenant.getTime()
  if (!(ms > 0)) return null
  const s = Math.floor(ms / 1000)
  return { jours: Math.floor(s / 86400), heures: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), secondes: s % 60 }
}

export function versPublique(p: Promotion): PromotionPublique {
  return {
    nom: p.nom, type_remise: p.type_remise, valeur: Number(p.valeur), fin: p.fin, service_ids: p.service_ids,
    bandeau_actif: p.bandeau_actif, bandeau_texte: p.bandeau_texte, bandeau_couleur: p.bandeau_couleur, bandeau_compteur: p.bandeau_compteur,
  }
}

export const COLONNES_PROMOTION = 'id, nom, type_remise, valeur, debut, fin, service_ids, bandeau_actif, bandeau_texte, bandeau_couleur, bandeau_compteur'

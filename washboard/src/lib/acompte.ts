import { z } from 'zod'
import { formatPhone, isValidPhone } from '@/lib/phone'

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

// Un lien par application (2026-10-17, Alexandre : « une case par appli ; il doit pouvoir
// proposer tous les types de paiement »). Le client voit un bouton par lien rempli.
//
// Seul PayPal.me accepte le montant dans l'adresse (`paypal.me/nom/16.05EUR`) : c'est le
// seul lien qui suit un acompte EN POURCENTAGE. Stripe, SumUp et Lydia ont un montant fixé
// à la création du lien, par le laveur, dans leur application.
export const APPLIS_PAIEMENT = [
  { cle: 'paypal', libelle: 'PayPal', exemple: 'https://paypal.me/votrenom', montantAuto: true },
  { cle: 'stripe', libelle: 'Stripe', exemple: 'https://buy.stripe.com/…', montantAuto: false },
  { cle: 'sumup', libelle: 'SumUp', exemple: 'https://pay.sumup.com/…', montantAuto: false },
  { cle: 'lydia', libelle: 'Lydia', exemple: 'https://…', montantAuto: false },
  { cle: 'autre', libelle: 'Autre', exemple: 'https://…', montantAuto: false },
] as const
export type AppliPaiement = (typeof APPLIS_PAIEMENT)[number]['cle']
export type LiensPaiement = Partial<Record<AppliPaiement, string>>

function lienValide(lien: string): boolean {
  try {
    return new URL(lien).protocol === 'https:'
  } catch {
    return false
  }
}

function estPaypalMe(lien: string): boolean {
  try {
    const u = new URL(lien)
    return /(^|\.)paypal\.me$/.test(u.hostname) || (/(^|\.)paypal\.com$/.test(u.hostname) && u.pathname.startsWith('/paypalme/'))
  } catch {
    return false
  }
}

/** Les liens remplis et valides, dans l'ordre des applications. */
function liensRemplis(liens: LiensPaiement | undefined): { cle: AppliPaiement; url: string }[] {
  return APPLIS_PAIEMENT
    .map(a => ({ cle: a.cle, url: (liens?.[a.cle] ?? '').trim() }))
    .filter(l => l.url && lienValide(l.url))
}

/** Réglages enregistrés avant le passage à un lien par application (un seul `lien`) :
 *  repris comme « Autre ». */
function reprendreAncienFormat(brut: unknown): unknown {
  if (brut && typeof brut === 'object' && 'lien' in brut && !('liens' in brut)) {
    const { lien, ...reste } = brut as { lien?: unknown }
    return { ...reste, liens: { autre: typeof lien === 'string' ? lien : '' } }
  }
  return brut
}

const ReglagesAcompteBase = z.object({
  actif: z.boolean(),
  type: z.enum(TYPES_ACOMPTE),
  valeur: z.number().positive('Indiquez le montant de l’acompte.'),
  /** Liens de paiement du laveur, un par application. Au moins un quand l'acompte est actif. */
  liens: z.object(Object.fromEntries(APPLIS_PAIEMENT.map(a => [a.cle, z.string().trim().max(500).optional()])) as Record<AppliPaiement, z.ZodOptional<z.ZodString>>),
  /** Heures pour payer avant annulation automatique ; `null` = jamais annulée. */
  delai_heures: z.number().int().positive().max(168).nullable(),
  remboursable: z.boolean(),
  /** Remboursé si le client annule au moins N heures avant le rendez-vous. */
  remboursement_heures: z.number().int().positive().max(720).nullable(),
  /** Virement bancaire (2026-10-17) : coordonnées montrées au client APRÈS la réservation
   *  seulement, jamais sur la page publique. */
  virement: z.object({
    titulaire: z.string().trim().max(70),
    iban: z.string().max(42),
  }).nullable().optional(),
  /** Wero (2026-10-17) : le numéro de téléphone du compte Wero du laveur, et le LIEN contenu
   *  dans son QR code Wero personnel (`https://share.weropay.eu/…`), lu dans la capture qu'il
   *  envoie. Un lien web : il s'ouvre aussi bien d'un bouton que d'un QR code scanné avec
   *  l'appareil photo. WashBoard redessine le QR code, net, à partir de ce lien. */
  wero: z.object({
    telephone: z.string().trim().max(20),
    lien: z.string().trim().max(300).nullable().optional(),
  }).nullable().optional(),
})

export const ReglagesAcompteSchema = z.preprocess(reprendreAncienFormat, ReglagesAcompteBase.superRefine((r, ctx) => {
  for (const a of APPLIS_PAIEMENT) {
    const lien = (r.liens[a.cle] ?? '').trim()
    if (lien && !lienValide(lien)) {
      ctx.addIssue({ code: 'custom', path: ['liens', a.cle], message: `Lien ${a.libelle} : collez l’adresse complète, qui commence par https://` })
    }
  }
  if (r.liens.paypal?.trim() && lienValide(r.liens.paypal.trim()) && !estPaypalMe(r.liens.paypal.trim())) {
    ctx.addIssue({ code: 'custom', path: ['liens', 'paypal'], message: 'Lien PayPal : utilisez votre lien PayPal.me (https://paypal.me/votrenom).' })
  }
  if (r.virement) {
    if (!r.virement.titulaire.trim()) ctx.addIssue({ code: 'custom', path: ['virement', 'titulaire'], message: 'Virement : indiquez le nom du titulaire du compte.' })
    if (!ibanValide(r.virement.iban)) ctx.addIssue({ code: 'custom', path: ['virement', 'iban'], message: 'Virement : cet IBAN n’est pas valide. Vérifiez-le sur votre RIB.' })
  }
  if (r.wero) {
    if (!isValidPhone(r.wero.telephone)) ctx.addIssue({ code: 'custom', path: ['wero', 'telephone'], message: 'Wero : indiquez le numéro de téléphone de votre compte Wero (ex. 06 12 34 56 78).' })
    if (r.wero.lien && !estLienWero(r.wero.lien)) ctx.addIssue({ code: 'custom', path: ['wero', 'lien'], message: 'Wero : ce QR code n’est pas un QR code Wero. Ajoutez la capture de votre QR code Wero.' })
  }
  if (r.actif && liensRemplis(r.liens).length === 0 && !r.virement && !r.wero) {
    ctx.addIssue({ code: 'custom', path: ['liens'], message: 'Ajoutez au moins un moyen de paiement : un lien, le virement ou Wero.' })
  }
  if (r.type === 'pourcentage' && r.valeur > 100) {
    ctx.addIssue({ code: 'custom', path: ['valeur'], message: 'Un acompte ne peut pas dépasser 100 % du prix.' })
  }
  if (r.remboursable && !r.remboursement_heures) {
    ctx.addIssue({ code: 'custom', path: ['remboursement_heures'], message: 'Choisissez jusqu’à quand l’acompte est remboursé.' })
  }
}))
export type ReglagesAcompte = z.infer<typeof ReglagesAcompteBase>

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
    : 'À régler après la réservation, avec l’un des liens de paiement.')
  lignes.push(r.remboursable && r.remboursement_heures
    ? `Remboursé si vous annulez au moins ${heures(r.remboursement_heures)} avant le rendez-vous.`
    : 'Non remboursable en cas d’annulation de votre part.')
  lignes.push('Le reste se règle sur place.')
  return lignes
}

/** Ce que la page publique reçoit des réglages : tout sauf l'interrupteur. */
/** Ce que la page publique reçoit AVANT la réservation : jamais l'IBAN, seulement le fait
 *  que le virement est proposé. */
export type AcomptePublic = Omit<ReglagesAcompte, 'actif' | 'virement' | 'wero'> & { virementPropose: boolean; weroPropose: boolean }

export function versPublic(r: ReglagesAcompte): AcomptePublic {
  const { actif: _actif, virement, wero, ...reste } = r
  return { ...reste, virementPropose: !!virement, weroPropose: !!wero }
}

export type WeroDu = { telephone: string; lien: string | null }

/** Un lien de paiement Wero, tel qu'on le trouve dans le QR code personnel d'un compte. */
export function estLienWero(lien: string): boolean {
  try {
    const u = new URL(lien)
    return u.protocol === 'https:' && /(^|\.)weropay\.eu$/.test(u.hostname)
  } catch {
    return false
  }
}

/** Coordonnées Wero montrées au client APRÈS la réservation. */
export function weroPour(r: Pick<ReglagesAcompte, 'wero'>): WeroDu | null {
  if (!r.wero || !isValidPhone(r.wero.telephone)) return null
  return { telephone: formatPhone(r.wero.telephone), lien: r.wero.lien && estLienWero(r.wero.lien) ? r.wero.lien : null }
}

/** IBAN sans espaces, en majuscules. */
export function normaliserIban(iban: string): string {
  return iban.replace(/\s+/g, '').toUpperCase()
}

/** Contrôle de l'IBAN : longueur et clé (modulo 97, norme ISO 13616). Écarte les fautes de
 *  frappe, pas les comptes fermés. */
export function ibanValide(iban: string): boolean {
  const i = normaliserIban(iban)
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(i)) return false
  const reordonne = i.slice(4) + i.slice(0, 4)
  let reste = 0
  for (const c of reordonne) {
    const v = /[A-Z]/.test(c) ? String(c.charCodeAt(0) - 55) : c
    for (const chiffre of v) reste = (reste * 10 + Number(chiffre)) % 97
  }
  return reste === 1
}

/** IBAN par groupes de quatre, pour qu'il se lise et se recopie sans erreur. */
export function formaterIban(iban: string): string {
  return normaliserIban(iban).replace(/(.{4})/g, '$1 ').trim()
}

/** Référence à mettre dans le libellé du virement : le laveur retrouve la réservation. */
export function referenceVirement(bookingId: string): string {
  return `WB-${bookingId.slice(0, 8).toUpperCase()}`
}

export type VirementDu = { titulaire: string; iban: string; reference: string }

export function virementPour(r: Pick<ReglagesAcompte, 'virement'>, bookingId: string): VirementDu | null {
  if (!r.virement || !ibanValide(r.virement.iban)) return null
  return { titulaire: r.virement.titulaire.trim(), iban: formaterIban(r.virement.iban), reference: referenceVirement(bookingId) }
}

/** Les boutons de paiement montrés au client, pour un acompte donné. Le lien PayPal.me reçoit
 *  le montant exact ; les autres s'ouvrent tels quels (montant fixé par le laveur). */
export function liensDePaiement(liens: LiensPaiement | undefined, montant: number): { cle: AppliPaiement; libelle: string; url: string; montantExact: boolean }[] {
  return liensRemplis(liens).map(l => {
    const appli = APPLIS_PAIEMENT.find(a => a.cle === l.cle)!
    if (l.cle === 'paypal' && estPaypalMe(l.url) && montant > 0) {
      const base = l.url.replace(/\/+$/, '').split('?')[0]
      // Une adresse qui porte déjà un montant (paypal.me/nom/30) le garde : on ne l'écrase pas.
      const dejaMontant = /\/\d+([.,]\d+)?([A-Z]{3})?$/.test(base)
      return { cle: l.cle, libelle: appli.libelle, url: dejaMontant ? base : `${base}/${montant.toFixed(2)}EUR`, montantExact: !dejaMontant }
    }
    return { cle: l.cle, libelle: appli.libelle, url: l.url, montantExact: false }
  })
}

/** Les moyens de paiement proposés, dits au client AVANT qu'il réserve. */
export function moyensPaiement(r: Pick<AcomptePublic, 'liens' | 'virementPropose' | 'weroPropose'>): string[] {
  const noms: string[] = liensRemplis(r.liens).map(l => APPLIS_PAIEMENT.find(a => a.cle === l.cle)!.libelle)
  if (r.weroPropose) noms.push('Wero')
  if (r.virementPropose) noms.push('virement')
  return noms
}


// Parrainage : règles pures, sans base ni réseau (testées dans parrainage.test.ts).
//
// - Tout laveur a un code (« BELLAUTO-K7P2 ») et peut parrainer.
// - Le filleul saisit le code à l'inscription, jamais après : 14 jours d'essai Pro en plus.
// - Quand le filleul devient abonné payant, le parrain gagne 1 mois, au minimum en Pro
//   (voir `recompenseParrain`). Une seule récompense par filleul, pas de plafond.

import { JOURS_ESSAI, ajouterMois, proOffertActif, washerPlan, type Plan } from '@/lib/plan'

export { proOffertActif }

export const JOURS_BONUS_FILLEUL = 14

/** Sans I, L, O, 0 ni 1 : un code se dicte au téléphone. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const LONGUEUR_ALEATOIRE = 4
const LONGUEUR_NOM_MAX = 10
const FORMAT_CODE = /^[A-Z0-9]{1,10}-[A-Z0-9]{4}$/

/** Code saisi ou reçu dans un lien, mis en forme ; `null` s'il ne peut pas être un code. */
export function normaliserCode(brut: unknown): string | null {
  if (typeof brut !== 'string') return null
  const code = brut.trim().toUpperCase()
  if (code.length > 20 || !FORMAT_CODE.test(code)) return null
  return code
}

/** Nom de l'entreprise réduit à des lettres et chiffres sans accent, pour le début du code. */
function racineDuNom(nom: string): string {
  const racine = nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, LONGUEUR_NOM_MAX)
  return racine.length >= 2 ? racine : 'WASH'
}

/** Tirage uniforme sur [0, max) : Web Crypto, disponible côté serveur comme dans le navigateur. */
function tirerAuHasard(max: number): number {
  const plafond = Math.floor(0x100000000 / max) * max
  const a = new Uint32Array(1)
  do globalThis.crypto.getRandomValues(a); while (a[0] >= plafond)
  return a[0] % max
}

export function genererCode(nom: string, tirer: (max: number) => number = tirerAuHasard): string {
  let suffixe = ''
  for (let i = 0; i < LONGUEUR_ALEATOIRE; i++) suffixe += ALPHABET[tirer(ALPHABET.length)]
  return `${racineDuNom(nom)}-${suffixe}`
}

/** `trial_ends_at` d'un filleul qui s'inscrit maintenant : l'essai normal plus le bonus. */
export function finEssaiFilleul(now: Date = new Date()): string {
  const jours = JOURS_ESSAI + JOURS_BONUS_FILLEUL
  return new Date(now.getTime() + jours * 24 * 60 * 60 * 1000).toISOString()
}

export type CompteParrainage = {
  plan?: string | null
  grandfathered?: boolean | null
  subscription_status?: string | null
  trial_ends_at?: string | null
  subscription_ends_at?: string | null
  pro_offert_jusqu_au?: string | null
}

export type StatutFilleul = 'essai' | 'client' | 'essai_termine'

/** Les trois seuls états que le parrain voit de son filleul. */
export function statutFilleul(w: CompteParrainage, now: Date = new Date()): StatutFilleul {
  if (w.subscription_status === 'active' || w.subscription_status === 'past_due') return 'client'
  const fin = w.trial_ends_at ? new Date(w.trial_ends_at).getTime() : NaN
  if (w.subscription_status === 'trial' && fin > now.getTime()) return 'essai'
  return 'essai_termine'
}

export type FormeRecompense =
  | 'abonnement'           // date de prochain paiement repoussée (et Pro offert sous le Pro)
  | 'abonnement_a_la_main' // abonné sans date de fin connue : l'équipe reporte le paiement elle-même
  | 'essai'                // essai Pro prolongé
  | 'pro_offert'           // un mois de Pro (Découverte, essai fini)
  | 'aucune'               // client historique : il a déjà tout

export type Recompense = {
  forme: FormeRecompense
  /** Colonnes de `washers` à écrire chez le parrain (vide = rien à écrire). */
  colonnes: { subscription_ends_at?: string; trial_ends_at?: string; pro_offert_jusqu_au?: string }
}

const RANG: Record<Plan, number> = { decouverte: 0, starter: 1, pro: 2, business: 3 }

function prolongerPro(w: CompteParrainage, now: Date): string {
  const depart = proOffertActif(w, now) ? new Date(w.pro_offert_jusqu_au!) : now
  return ajouterMois(depart, 1).toISOString()
}

/** Ce que gagne le parrain quand un de ses filleuls devient abonné.
 *
 *  - Abonné Starter : 1 mois en Pro, et son prochain paiement recule d'un mois.
 *  - Abonné Pro ou Business : son prochain paiement recule d'un mois.
 *  - En essai Pro : l'essai dure un mois de plus.
 *  - Découverte (essai fini, rien payé, ou abonnement arrêté) : 1 mois de Pro.
 *  - Client historique : rien. */
export function recompenseParrain(w: CompteParrainage, now: Date = new Date()): Recompense {
  if (w.grandfathered) return { forme: 'aucune', colonnes: {} }

  const plan = washerPlan(w)
  if (w.subscription_status === 'active' || w.subscription_status === 'past_due') {
    const colonnes: Recompense['colonnes'] = {}
    if (RANG[plan] < RANG.pro) colonnes.pro_offert_jusqu_au = prolongerPro(w, now)
    const fin = w.subscription_ends_at ? new Date(w.subscription_ends_at) : null
    if (!fin || Number.isNaN(fin.getTime())) return { forme: 'abonnement_a_la_main', colonnes }
    colonnes.subscription_ends_at = ajouterMois(fin, 1).toISOString()
    return { forme: 'abonnement', colonnes }
  }

  const finEssai = w.trial_ends_at ? new Date(w.trial_ends_at) : null
  const enEssai = w.subscription_status === 'trial' && !!finEssai && finEssai.getTime() > now.getTime()
  if (enEssai && RANG[plan] >= RANG.pro) {
    return { forme: 'essai', colonnes: { trial_ends_at: ajouterMois(finEssai!, 1).toISOString() } }
  }

  return { forme: 'pro_offert', colonnes: { pro_offert_jusqu_au: prolongerPro(w, now) } }
}

/** Lien d'invitation à partager. */
export function lienParrainage(base: string, code: string): string {
  return `${base.replace(/\/$/, '')}/signup?parrain=${encodeURIComponent(code)}`
}

function dateLongue(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long' })
}

/** Ce que le parrain a gagné, en une phrase (email et notification). */
export function phraseRecompense(r: Recompense): string {
  const pro = r.colonnes.pro_offert_jusqu_au ? ` Vous profitez de l’offre Pro jusqu’au ${dateLongue(r.colonnes.pro_offert_jusqu_au)}.` : ''
  switch (r.forme) {
    case 'abonnement':
      return `Votre prochain paiement est repoussé au ${dateLongue(r.colonnes.subscription_ends_at!)}.${pro}`
    case 'abonnement_a_la_main':
      return `Votre prochain paiement est repoussé d’un mois, notre équipe s’en occupe.${pro}`
    case 'essai':
      return `Votre essai gratuit est prolongé jusqu’au ${dateLongue(r.colonnes.trial_ends_at!)}.`
    case 'pro_offert':
      return pro.trim()
    case 'aucune':
      return ''
  }
}

const JOUR_MS = 24 * 60 * 60 * 1000
export const JOURS_AVANT_CARTE = 7
export const RETOUR_CARTE_JOURS = { min: 14, max: 28 } as const

/** La carte de rappel de l'accueil : jamais pour un client historique ni pour qui parraine déjà,
 *  pas avant la première réservation reçue (ou 7 jours de compte), pas avant sa date de retour. */
export function carteParrainageVisible(c: {
  grandfathered?: boolean | null
  createdAt?: string | null
  revoirLe?: string | null
  aDesFilleuls: boolean
  aUneReservation: boolean
}, now: Date = new Date()): boolean {
  if (c.grandfathered || c.aDesFilleuls) return false
  if (c.revoirLe && new Date(c.revoirLe).getTime() > now.getTime()) return false
  if (c.aUneReservation) return true
  const cree = c.createdAt ? new Date(c.createdAt).getTime() : NaN
  return Number.isFinite(cree) && now.getTime() - cree >= JOURS_AVANT_CARTE * JOUR_MS
}

/** Carte fermée : elle revient à une date tirée au hasard entre 2 et 4 semaines plus tard. */
export function dateRetourCarte(now: Date = new Date(), tirer: (max: number) => number = tirerAuHasard): string {
  const jours = RETOUR_CARTE_JOURS.min + tirer(RETOUR_CARTE_JOURS.max - RETOUR_CARTE_JOURS.min + 1)
  return new Date(now.getTime() + jours * JOUR_MS).toISOString()
}

// Offres WashBoard et contrôle d'accès aux fonctionnalités.
//
// Grille 2026 (remplace l'ancienne : Essentiel 49 € / Pro 69 €) :
//
//   - decouverte (0 €)   : essayer pour de vrai. 5 réservations/mois,
//                          3 prestations, page marquée WashBoard, agenda et
//                          fiches clients.
//   - starter    (19 €)  : + 15 réservations/mois, catalogue illimité, page
//                          personnalisée, CRM, suivi simple du chiffre d'affaires.
//   - pro        (49 €)  : + réservations illimitées, créneaux et trajets
//                          intelligents, comptabilité et facturation, avis
//                          Google (email et SMS, 150 inclus), relances.
//   - business   (129 €) : + planning collectif, 3 laveurs inclus,
//                          19 €/mois par laveur supplémentaire.
//
// Deux mécanismes distincts, à ne pas confondre :
//   - `hasFeature` : la fonctionnalité existe-t-elle dans l'offre ? (oui/non)
//   - les quotas   : la fonctionnalité existe, mais avec un plafond mensuel.
//
// Les laveurs `grandfathered` (clients historiques) ont tout débloqué et aucun
// plafond, quel que soit leur plan, pour ne jamais leur retirer un acquis.

import { minuitParisUTC } from '@/lib/dateUtils'

/** Domaine servi en production (celui vers lequel washboard.fr redirige). */
export const SITE_URL_FALLBACK = 'https://www.washboard.fr'

export type Plan = 'decouverte' | 'starter' | 'pro' | 'business'
export type Feature =
  | 'page_personnalisee'
  | 'crm'
  | 'ca_simple'
  | 'avis_email'
  | 'avis_sms'
  | 'compta'
  | 'facturation'
  | 'creneaux_intelligents'
  | 'frais_deplacement'
  | 'followup'
  | 'multi_laveurs'
export type BillingCycle = 'monthly' | 'yearly'

const PLANS: Plan[] = ['decouverte', 'starter', 'pro', 'business']
const RANK: Record<Plan, number> = { decouverte: 0, starter: 1, pro: 2, business: 3 }

// Anciennes valeurs encore présentes en base. Un compte « essentiel » payait
// 49 € : il retrouve exactement ce tarif dans le nouveau Pro, avec davantage
// de fonctionnalités. Le repli se fait donc vers le haut — jamais vers une
// offre moins-disante, sinon un client perdrait un acquis le jour du déploiement.
const PLAN_ALIASES: Record<string, Plan> = {
  essentiel: 'pro',
}

const MIN_PLAN: Record<Feature, Plan> = {
  // Découverte : agenda, fiches clients et réservation. Rien de plus.
  page_personnalisee:    'starter',
  crm:                   'starter',
  ca_simple:             'starter',
  avis_email:            'pro',
  avis_sms:              'pro',
  compta:                'pro',
  facturation:           'pro',
  creneaux_intelligents: 'pro',
  frais_deplacement:     'pro',
  followup:              'pro',
  multi_laveurs:         'business',
}

export const PLAN_LABELS: Record<Plan, string> = {
  decouverte: 'Découverte',
  starter:    'Starter',
  pro:        'Pro',
  business:   'Business',
}

export const PLAN_PRICES: Record<Plan, number> = {
  decouverte: 0,
  starter:    19,
  pro:        49,
  business:   129,
}

// ── Quotas mensuels ────────────────────────────────────────────────────────
//
// `null` = pas de plafond. On écrit `null` et pas `Infinity` : une valeur
// numérique invite à la comparer, et une comparaison oubliée sur `Infinity`
// passe inaperçue, là où un `null` fait échouer le typage.

/** Réservations acceptées par mois civil (fuseau Paris). */
export const BOOKING_QUOTA: Record<Plan, number | null> = {
  decouverte: 5,
  starter:    15,
  pro:        null,
  business:   null,
}

/** Prestations au catalogue. Ce n'est pas un plafond mensuel : c'est le
 *  nombre de lignes que le laveur peut avoir en même temps. */
export const SERVICE_QUOTA: Record<Plan, number | null> = {
  decouverte: 3,
  starter:    null,
  pro:        null,
  business:   null,
}

/** SMS d'avis inclus par mois (0 = email uniquement). */
export const SMS_QUOTA: Record<Plan, number> = {
  decouverte: 0,
  starter:    0,
  pro:        150,
  business:   150,
}

/** Laveurs simultanés compris dans l'offre. Au-delà, c'est facturé
 *  (PRIX_LAVEUR_SUPPLEMENTAIRE) — ce n'est pas un blocage technique, mais le
 *  chiffre affiché au laveur avant qu'il augmente son équipe. */
export const TEAM_SIZE_INCLUS: Record<Plan, number> = {
  decouverte: 1,
  starter:    1,
  pro:        1,
  business:   3,
}

export const PRIX_LAVEUR_SUPPLEMENTAIRE = 19

/** Offre dont dispose un laveur pendant son essai gratuit.
 *
 *  L'essai montre le produit complet : le brider à l'offre gratuite en ferait
 *  une démonstration de ce qu'on ne vend pas. À la fin de l'essai, faute de
 *  paiement, le compte retombe sur la grille normale. */
export const PLAN_ESSAI: Plan = 'pro'

/** Offre à laquelle correspond le tarif des clients historiques
 *  (`grandfathered`). Ils payaient 49 € pour l'ancien Essentiel : c'est
 *  exactement le tarif du Pro dans la grille 2026, et ils ont tout débloqué.
 *  Sert à afficher LEUR prix, jamais celui de la première carte de la grille —
 *  qui est désormais l'offre gratuite. */
export const PLAN_HISTORIQUE: Plan = 'pro'

// Les clients historiques avaient un quota illimité via l'ancien plan Business ;
// on le leur conserve explicitement maintenant que ce plan n'existe plus.
export const GRANDFATHERED_SMS_QUOTA = 100000

// Engagement annuel : 1 mois offert (on facture 11 mois pour 12).
export const YEARLY_FREE_MONTHS = 1

export function yearlyPrice(monthlyPrice: number): number {
  return monthlyPrice * (12 - YEARLY_FREE_MONTHS)
}

/** « 1 mois offert » / « 2 mois offerts ».
 *
 *  L'accord était écrit en dur au pluriel à cinq endroits : passer l'offre à
 *  un seul mois affichait « 1 mois offerts ». Une seule source évite d'en
 *  oublier un. */
export function freeMonthsLabel(): string {
  return YEARLY_FREE_MONTHS > 1
    ? `${YEARLY_FREE_MONTHS} mois offerts`
    : `${YEARLY_FREE_MONTHS} mois offert`
}

// Prix mensuel équivalent d'un engagement annuel, arrondi au centime.
export function yearlyMonthlyEquivalent(monthlyPrice: number): number {
  return Math.round((yearlyPrice(monthlyPrice) / 12) * 100) / 100
}

// Formatage FR d'un montant : "40,83" / "57,50" / "490". Un montant rond
// s'écrit sans centimes ; dès qu'il y en a, on affiche les deux décimales
// (sinon on obtiendrait "57,5 €", qui ne se lit pas comme un prix).
export function formatEuros(amount: number): string {
  const decimals = Number.isInteger(amount) ? 0 : 2
  return amount.toLocaleString('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

// Descriptif des offres (partagé entre la page Abonnement et la landing).
// `price` est toujours le tarif mensuel ; l'annuel s'en déduit via yearlyPrice().
//
// Règle de rédaction : on n'annonce ici que ce que le produit sait faire
// aujourd'hui. Une ligne de plus sur une carte, c'est une promesse de vente.
export type PlanCard = {
  key: Plan
  name: string
  price: number
  /** Tarif de départ (Business : le prix dépend du nombre de laveurs). */
  from?: boolean
  tagline: string
  features: string[]
  /** Offre mise en avant sur la grille. */
  highlight?: boolean
}

export const PLAN_CARDS: PlanCard[] = [
  {
    key: 'decouverte', name: 'Découverte', price: 0,
    tagline: 'Pour essayer avec de vrais clients.',
    features: [
      '5 réservations par mois',
      '3 prestations au catalogue',
      'Agenda et fiches clients',
      'Page de réservation aux couleurs WashBoard',
    ],
  },
  {
    key: 'starter', name: 'Starter', price: 19,
    tagline: 'Pour remplir son planning sans y penser.',
    features: [
      '15 réservations par mois',
      'Catalogue de prestations illimité',
      'Page de réservation personnalisée (logo, couleurs)',
      'CRM : d’où viennent vos clients',
      'Suivi simple du chiffre d’affaires',
    ],
  },
  {
    key: 'pro', name: 'Pro', price: 49, highlight: true,
    tagline: 'Pour vivre de son activité.',
    features: [
      'Réservations illimitées',
      'Créneaux intelligents et frais de déplacement',
      'Comptabilité et facturation conforme (SIRET, TVA)',
      'Avis Google automatiques — email et SMS (150/mois)',
      'Relances de suivi client',
    ],
  },
  {
    key: 'business', name: 'Business', price: 129, from: true,
    tagline: 'Pour une équipe sur la route.',
    features: [
      'Tout le Pro',
      '3 laveurs inclus',
      `+${PRIX_LAVEUR_SUPPLEMENTAIRE} €/mois par laveur supplémentaire`,
      'Planning collectif (rendez-vous simultanés)',
    ],
  },
]

type PlanInfo = { plan?: string | null; grandfathered?: boolean | null }

export function washerPlan(w: PlanInfo | null | undefined): Plan {
  const brut = String(w?.plan ?? 'decouverte')
  if (PLANS.includes(brut as Plan)) return brut as Plan
  // Valeur héritée connue, sinon repli sur l'offre gratuite : une chaîne
  // inconnue en base ne doit jamais ouvrir un accès payant.
  return PLAN_ALIASES[brut] ?? 'decouverte'
}

export function hasFeature(w: PlanInfo | null | undefined, feature: Feature): boolean {
  if (w?.grandfathered) return true
  return RANK[washerPlan(w)] >= RANK[MIN_PLAN[feature]]
}

// Libellé du plan minimum requis pour une fonctionnalité (pour les invites d'upgrade).
export function requiredPlanLabel(feature: Feature): string {
  return PLAN_LABELS[MIN_PLAN[feature]]
}

// ── Lecture des quotas ─────────────────────────────────────────────────────

/** Réservations autorisées ce mois-ci, `null` si illimité. */
export function quotaReservations(w: PlanInfo | null | undefined): number | null {
  if (w?.grandfathered) return null
  return BOOKING_QUOTA[washerPlan(w)]
}

/** Prestations autorisées au catalogue, `null` si illimité. */
export function quotaPrestations(w: PlanInfo | null | undefined): number | null {
  if (w?.grandfathered) return null
  return SERVICE_QUOTA[washerPlan(w)]
}

/** Vrai si un élément de plus dépasse le plafond. `dejaUtilise` est le nombre
 *  d'éléments AVANT l'ajout : avec un quota de 5, on accepte les cinq
 *  premiers et on refuse le sixième. */
export function quotaDepasse(quota: number | null, dejaUtilise: number): boolean {
  return quota !== null && dejaUtilise >= quota
}

/** Instant UTC du 1er du mois courant, à minuit heure de Paris.
 *
 *  Les quotas sont mensuels et se remettent à zéro le 1er. Le calcul passe par
 *  le fuseau parisien : borner sur l'UTC ferait basculer les réservations du
 *  1er avant 2h du matin sur le mois précédent (déjà consommé), et ferait donc
 *  refuser une réservation alors que le compteur venait d'être remis à zéro. */
export function debutDuMoisParis(now: Date = new Date()): Date {
  const [annee, mois] = now
    .toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })
    .split('-')
  return minuitParisUTC(`${annee}-${mois}-01`)
}

// Vrai si la période de grâce de 30 jours après l'échéance (subscription_ends_at,
// ou trial_ends_at si jamais encore abonné) est dépassée. Un abonnement actif
// n'est jamais concerné — à vérifier séparément par l'appelant.
export function graceEnded(
  subscriptionEndsAt: string | null,
  trialEndsAt: string | null,
  now: Date = new Date(),
): boolean {
  const baseDate = subscriptionEndsAt ? new Date(subscriptionEndsAt) : trialEndsAt ? new Date(trialEndsAt) : null
  if (!baseDate) return false
  const graceEnd = new Date(baseDate)
  graceEnd.setDate(graceEnd.getDate() + 30)
  return now > graceEnd
}

// Nombre de mois dus depuis la dernière échéance payée (subscription_ends_at,
// ou trial_ends_at si jamais encore abonné). 0 tant que l'échéance n'est pas
// passée ; 1 dès le jour J ; +1 par tranche de 30 jours de retard supplémentaire.
export function monthsOwed(
  subscriptionEndsAt: string | null,
  trialEndsAt: string | null,
  now: Date = new Date(),
): number {
  const baseDate = subscriptionEndsAt ? new Date(subscriptionEndsAt) : trialEndsAt ? new Date(trialEndsAt) : null
  if (!baseDate) return 0
  const diffDays = (now.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24)
  if (diffDays <= 0) return 0
  return Math.floor(diffDays / 30) + 1
}

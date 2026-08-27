// Plans WashBoard et contrôle d'accès aux fonctionnalités.
//
// - essentiel (49€) : résa, agenda, CRM, avis Google par email
// - pro (69€)       : + comptabilité, avis par SMS (quota), suivi client,
//                     multi-laveurs
//
// Les laveurs `grandfathered` (clients historiques) ont tout débloqué quel
// que soit leur plan, pour ne jamais leur retirer un acquis.

/** Domaine servi en production (celui vers lequel washboard.fr redirige). */
export const SITE_URL_FALLBACK = 'https://www.washboard.fr'

export type Plan = 'essentiel' | 'pro'
export type Feature = 'avis_email' | 'compta' | 'avis_sms' | 'multi_laveurs' | 'followup'
export type BillingCycle = 'monthly' | 'yearly'

const PLANS: Plan[] = ['essentiel', 'pro']
const RANK: Record<Plan, number> = { essentiel: 0, pro: 1 }

const MIN_PLAN: Record<Feature, Plan> = {
  avis_email:    'essentiel',
  compta:        'pro',
  avis_sms:      'pro',
  followup:      'pro',
  multi_laveurs: 'pro',
}

export const PLAN_LABELS: Record<Plan, string> = {
  essentiel: 'Essentiel',
  pro:       'Pro',
}

export const PLAN_PRICES: Record<Plan, number> = {
  essentiel: 49,
  pro:       69,
}

// Quota de SMS d'avis inclus par mois (0 = email uniquement).
export const SMS_QUOTA: Record<Plan, number> = {
  essentiel: 0,
  pro:       150,
}

// Les clients historiques avaient un quota illimité via l'ancien plan Business ;
// on le leur conserve explicitement maintenant que ce plan n'existe plus.
export const GRANDFATHERED_SMS_QUOTA = 100000

// Engagement annuel : 2 mois offerts (on facture 10 mois pour 12).
export const YEARLY_FREE_MONTHS = 2

export function yearlyPrice(monthlyPrice: number): number {
  return monthlyPrice * (12 - YEARLY_FREE_MONTHS)
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
export type PlanCard = { key: Plan; name: string; price: number; tagline: string; features: string[] }

export const PLAN_CARDS: PlanCard[] = [
  {
    key: 'essentiel', name: 'Essentiel', price: 49,
    tagline: 'Pour démarrer et être pro tout de suite.',
    features: [
      'Page de réservation personnalisée',
      'Agenda + créneaux intelligents',
      'Frais de déplacement, multi-véhicules',
      'CRM analytique',
      'Avis Google par email',
    ],
  },
  {
    key: 'pro', name: 'Pro', price: 69,
    tagline: 'Pour piloter votre activité.',
    features: [
      'Tout l’Essentiel',
      'Comptabilité (CA, dépenses, résultat)',
      'Avis Google par SMS (150/mois)',
      'Relances de suivi client',
      'Multi-laveurs (RDV simultanés)',
    ],
  },
]

type PlanInfo = { plan?: string | null; grandfathered?: boolean | null }

export function washerPlan(w: PlanInfo | null | undefined): Plan {
  const p = (w?.plan ?? 'essentiel') as Plan
  return PLANS.includes(p) ? p : 'essentiel'
}

export function hasFeature(w: PlanInfo | null | undefined, feature: Feature): boolean {
  if (w?.grandfathered) return true
  return RANK[washerPlan(w)] >= RANK[MIN_PLAN[feature]]
}

// Libellé du plan minimum requis pour une fonctionnalité (pour les invites d'upgrade).
export function requiredPlanLabel(feature: Feature): string {
  return PLAN_LABELS[MIN_PLAN[feature]]
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

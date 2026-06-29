// Plans WashBoard et contrôle d'accès aux fonctionnalités.
//
// - essentiel (49€) : résa, agenda, CRM, avis Google par email
// - pro (69€)       : + comptabilité, avis par SMS (quota), suivi client
// - business (99€)  : + multi-laveurs, SMS illimité, perso avancée
//
// Les laveurs `grandfathered` (clients historiques) ont tout débloqué quel
// que soit leur plan, pour ne jamais leur retirer un acquis.

export type Plan = 'essentiel' | 'pro' | 'business'
export type Feature = 'avis_email' | 'compta' | 'avis_sms' | 'multi_laveurs'

const PLANS: Plan[] = ['essentiel', 'pro', 'business']
const RANK: Record<Plan, number> = { essentiel: 0, pro: 1, business: 2 }

const MIN_PLAN: Record<Feature, Plan> = {
  avis_email:    'essentiel',
  compta:        'pro',
  avis_sms:      'pro',
  multi_laveurs: 'business',
}

export const PLAN_LABELS: Record<Plan, string> = {
  essentiel: 'Essentiel',
  pro:       'Pro',
  business:  'Business',
}

export const PLAN_PRICES: Record<Plan, number> = {
  essentiel: 49,
  pro:       69,
  business:  99,
}

// Quota de SMS d'avis inclus par mois (0 = email uniquement).
export const SMS_QUOTA: Record<Plan, number> = {
  essentiel: 0,
  pro:       150,
  business:  100000,
}

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

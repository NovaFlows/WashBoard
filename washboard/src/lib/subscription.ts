// Logique d'abonnement pure (sans SDK Stripe ni accès réseau/DB), pour être
// testable unitairement. Utilisée par le webhook Stripe et la route checkout.

export type SubStatus = 'active' | 'trial' | 'past_due' | 'expired'

// Traduit un statut d'abonnement Stripe vers notre statut applicatif.
// - trialing → trial (essai, éventuellement avec facturation différée)
// - active → active
// - past_due → past_due (paiement échoué, accès conservé le temps de la relance)
// - tout le reste (canceled, unpaid, incomplete_expired, paused…) → expired
export function mapStripeStatus(stripeStatus: string): SubStatus {
  switch (stripeStatus) {
    case 'active':   return 'active'
    case 'trialing': return 'trial'
    case 'past_due': return 'past_due'
    default:         return 'expired'
  }
}

// Convertit un timestamp Stripe (secondes epoch) de résiliation programmée en ISO,
// ou null s'il n'y a pas de résiliation. Stripe renseigne `cancel_at` même pendant
// un essai (où `cancel_at_period_end` reste false) → on se base sur `cancel_at` seul.
export function stripeCancelToIso(cancelAt: number | null | undefined): string | null {
  return cancelAt ? new Date(cancelAt * 1000).toISOString() : null
}

// Un laveur est déjà abonné (donc ne doit pas créer une 2ᵉ souscription) dès qu'il
// a un abonnement Stripe rattaché et un statut « vivant » (actif, en relance, ou
// essai avec carte déjà enregistrée).
export function isAlreadySubscribed(args: {
  subscriptionId: string | null | undefined
  status: string | null | undefined
}): boolean {
  return (
    !!args.subscriptionId &&
    (args.status === 'active' || args.status === 'past_due' || args.status === 'trial')
  )
}

export function isCardRegistered(
  subscriptionId: string | null | undefined,
  status: string | null | undefined,
): boolean {
  return !!subscriptionId && status === 'trial'
}

export function formatDateFR(date: string | Date): string {
  return new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Détermine si l'on peut différer la facturation à la fin de l'essai.
// Stripe exige un `trial_end` à au moins 48h dans le futur : sinon on facture
// immédiatement (retourne null) plutôt que de risquer un rejet de la session.
const MIN_TRIAL_MS = 48 * 60 * 60 * 1000
export function computeTrialEnd(
  status: string | null | undefined,
  trialEndsAt: string | null | undefined,
  now: number = Date.now(),
): number | undefined {
  if (status !== 'trial' || !trialEndsAt) return undefined
  const end = new Date(trialEndsAt).getTime()
  if (Number.isNaN(end)) return undefined
  if (end - now < MIN_TRIAL_MS) return undefined
  return Math.floor(end / 1000)
}

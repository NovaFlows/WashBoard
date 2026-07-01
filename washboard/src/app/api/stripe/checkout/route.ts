import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe, STRIPE_PRICE_IDS } from '@/lib/stripe'
import { PLAN_CARDS, type Plan } from '@/lib/plan'
import { isAlreadySubscribed, computeTrialEnd } from '@/lib/subscription'
import { withErrorHandling, AppError } from '@/lib/apiError'
import { logger } from '@/lib/logger'

export const POST = withErrorHandling('stripe.checkout', async (req: NextRequest) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new AppError('non authentifié', { status: 401, publicMessage: 'Non autorisé' })

  const { plan } = await req.json() as { plan: Plan }
  const priceId = STRIPE_PRICE_IDS[plan]
  if (!priceId) throw new AppError('plan inconnu', { status: 400, publicMessage: 'Plan invalide' })

  // Blocage serveur : impossible de souscrire à une offre encore en développement.
  const planCard = PLAN_CARDS.find(c => c.key === plan)
  if (planCard?.comingSoon) {
    throw new AppError('plan comingSoon', { status: 400, publicMessage: 'Cette offre n’est pas encore disponible' })
  }

  const { data: washer } = await supabase
    .from('washers')
    .select('id, stripe_customer_id, stripe_subscription_id, subscription_status, trial_ends_at, grandfathered')
    .eq('user_id', user.id)
    .single()
  if (!washer) throw new AppError('washer introuvable', { status: 404, publicMessage: 'Laveur introuvable' })

  // Les laveurs historiques (grandfathered) ont déjà tout débloqué → pas de paiement.
  if (washer.grandfathered) {
    throw new AppError('grandfathered', {
      status: 400,
      publicMessage: 'Votre compte bénéficie déjà d’un accès complet, aucun abonnement nécessaire.',
    })
  }

  // Garde-fou double abonnement : un laveur déjà abonné (paiement en cours ou
  // carte déjà enregistrée pendant l'essai) ne doit pas créer une 2ᵉ souscription.
  if (isAlreadySubscribed({ subscriptionId: washer.stripe_subscription_id, status: washer.subscription_status })) {
    throw new AppError('déjà abonné', {
      status: 409,
      publicMessage: 'Vous avez déjà un abonnement. Utilisez « Gérer mon abonnement » pour le modifier.',
    })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  // Facturation différée à la fin de l'essai (si l'essai reste ≥ 48h, contrainte Stripe).
  const trialEnd = computeTrialEnd(washer.subscription_status, washer.trial_ends_at)

  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    ...(washer.stripe_customer_id
      ? { customer: washer.stripe_customer_id }
      : { customer_email: user.email ?? undefined }
    ),
    client_reference_id: user.id,
    metadata: { washer_id: washer.id, plan },
    ...(trialEnd ? { subscription_data: { trial_end: trialEnd } } : {}),
    success_url: `${appUrl}/dashboard/abonnement?success=1`,
    cancel_url:  `${appUrl}/dashboard/abonnement?cancelled=1`,
  })

  logger.info('stripe.checkout.session_created', { washerId: washer.id, plan, deferred: !!trialEnd })
  return NextResponse.json({ url: session.url })
})

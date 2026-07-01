import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe, STRIPE_PRICE_IDS } from '@/lib/stripe'
import { PLAN_CARDS, type Plan } from '@/lib/plan'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { plan } = await req.json() as { plan: Plan }
  const priceId = STRIPE_PRICE_IDS[plan]
  if (!priceId) return NextResponse.json({ error: 'Plan invalide' }, { status: 400 })

  // Blocage serveur : impossible de souscrire à une offre encore en développement.
  const planCard = PLAN_CARDS.find(c => c.key === plan)
  if (planCard?.comingSoon) {
    return NextResponse.json({ error: 'Cette offre n’est pas encore disponible' }, { status: 400 })
  }

  const { data: washer } = await supabase
    .from('washers')
    .select('id, stripe_customer_id, stripe_subscription_id, subscription_status, trial_ends_at')
    .eq('user_id', user.id)
    .single()
  if (!washer) return NextResponse.json({ error: 'Laveur introuvable' }, { status: 404 })

  // Garde-fou double abonnement : un laveur déjà abonné (paiement en cours ou
  // carte déjà enregistrée pendant l'essai) ne doit pas créer une 2ᵉ souscription.
  const alreadySubscribed =
    !!washer.stripe_subscription_id &&
    (washer.subscription_status === 'active' ||
     washer.subscription_status === 'past_due' ||
     washer.subscription_status === 'trial')
  if (alreadySubscribed) {
    return NextResponse.json(
      { error: 'Vous avez déjà un abonnement. Utilisez « Gérer mon abonnement » pour le modifier.' },
      { status: 409 },
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  // Si l'utilisateur est en essai avec des jours restants, différer la facturation
  let trialEnd: number | undefined
  if (washer.subscription_status === 'trial' && washer.trial_ends_at) {
    const trialEndDate = new Date(washer.trial_ends_at)
    if (trialEndDate.getTime() > Date.now()) {
      trialEnd = Math.floor(trialEndDate.getTime() / 1000)
    }
  }

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

  return NextResponse.json({ url: session.url })
}

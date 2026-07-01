import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getStripe, planFromPriceId } from '@/lib/stripe'
import type Stripe from 'stripe'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Webhook signature invalide' }, { status: 400 })
  }

  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  switch (event.type) {
    case 'checkout.session.completed': {
      const session  = event.data.object as Stripe.Checkout.Session
      const washerId = session.metadata?.washer_id
      const plan     = session.metadata?.plan
      if (!washerId || !plan) break

      const subscriptionId = session.subscription as string
      const subscription   = await getStripe().subscriptions.retrieve(subscriptionId)

      // Si l'abonnement est en période d'essai différée (trial_end passé à Stripe),
      // on garde subscription_status = 'trial' pour préserver l'essai,
      // mais on stocke les IDs — l'UI détecte "carte enregistrée" via stripe_subscription_id non null.
      const newStatus = subscription.status === 'trialing' ? 'trial' : 'active'

      await admin.from('washers').update({
        stripe_customer_id:     session.customer as string,
        stripe_subscription_id: subscriptionId,
        plan,
        subscription_status:    newStatus,
      }).eq('id', washerId)
      break
    }

    case 'customer.subscription.updated': {
      const sub        = event.data.object as Stripe.Subscription
      const customerId = sub.customer as string
      const priceId    = sub.items.data[0]?.price.id
      const plan       = priceId ? planFromPriceId(priceId) : null
      const status     = sub.status === 'active'   ? 'active'
                       : sub.status === 'trialing' ? 'trial'
                       : sub.status === 'past_due' ? 'past_due'
                       : 'expired'

      await admin.from('washers').update({
        ...(plan ? { plan } : {}),
        subscription_status: status,
      }).eq('stripe_customer_id', customerId)
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await admin.from('washers').update({
        subscription_status:    'expired',
        stripe_subscription_id: null,
      }).eq('stripe_customer_id', sub.customer as string)
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      await admin.from('washers').update({
        subscription_status: 'past_due',
      }).eq('stripe_customer_id', invoice.customer as string)
      break
    }
  }

  return NextResponse.json({ ok: true })
}

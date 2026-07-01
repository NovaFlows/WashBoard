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

      // Lire le statut actuel pour savoir si on était en essai (facturation différée)
      const { data: washer } = await admin
        .from('washers')
        .select('subscription_status')
        .eq('id', washerId)
        .single()

      // Si le laveur était en trial → on garde 'trial' (billing différé, IDs stockés)
      // Sinon → 'active' (paiement immédiat)
      const newStatus = washer?.subscription_status === 'trial' ? 'trial' : 'active'

      await admin.from('washers').update({
        stripe_customer_id:     session.customer as string,
        stripe_subscription_id: session.subscription as string,
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

      // Résiliation programmée : l'abonnement reste actif jusqu'à cancel_at
      const cancelsAt = sub.cancel_at_period_end && sub.cancel_at
        ? new Date(sub.cancel_at * 1000).toISOString()
        : null

      await admin.from('washers').update({
        ...(plan ? { plan } : {}),
        subscription_status: status,
        cancels_at: cancelsAt,
      }).eq('stripe_customer_id', customerId)
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await admin.from('washers').update({
        subscription_status:    'expired',
        stripe_subscription_id: null,
        cancels_at:             null,
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

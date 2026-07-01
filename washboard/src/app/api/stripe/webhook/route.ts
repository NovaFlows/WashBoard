import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getStripe, planFromPriceId } from '@/lib/stripe'
import { mapStripeStatus, stripeCancelToIso } from '@/lib/subscription'
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

  // Toute erreur d'écriture DB → on renvoie 500 pour que Stripe réessaie le webhook.
  let dbError: unknown = null

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

      const { error } = await admin.from('washers').update({
        stripe_customer_id:     session.customer as string,
        stripe_subscription_id: session.subscription as string,
        plan,
        subscription_status:    newStatus,
        cancels_at:             null, // ré-abonnement : on efface toute résiliation antérieure
      }).eq('id', washerId)
      if (error) { console.error('[webhook] checkout.completed error:', error); dbError = error }
      break
    }

    case 'customer.subscription.updated': {
      const sub        = event.data.object as Stripe.Subscription
      const priceId    = sub.items.data[0]?.price.id
      const plan       = priceId ? planFromPriceId(priceId) : null
      const status     = mapStripeStatus(sub.status)
      const cancelsAt  = stripeCancelToIso(sub.cancel_at)

      // On matche sur stripe_subscription_id (fiable), fallback sur customer_id.
      const { data, error } = await admin.from('washers').update({
        ...(plan ? { plan } : {}),
        subscription_status: status,
        cancels_at: cancelsAt,
      }).eq('stripe_subscription_id', sub.id).select('id')

      if (error) { console.error('[webhook] subscription.updated error:', error); dbError = error }
      else if (!data || data.length === 0) {
        // Fallback : la ligne n'a pas encore stripe_subscription_id → matcher sur customer
        const { error: err2 } = await admin.from('washers').update({
          ...(plan ? { plan } : {}),
          stripe_subscription_id: sub.id,
          subscription_status: status,
          cancels_at: cancelsAt,
        }).eq('stripe_customer_id', sub.customer as string)
        if (err2) { console.error('[webhook] subscription.updated fallback error:', err2); dbError = err2 }
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const { error } = await admin.from('washers').update({
        subscription_status:    'expired',
        stripe_subscription_id: null,
        cancels_at:             null,
      }).eq('stripe_subscription_id', sub.id)
      if (error) { console.error('[webhook] subscription.deleted error:', error); dbError = error }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const { error } = await admin.from('washers').update({
        subscription_status: 'past_due',
      }).eq('stripe_customer_id', invoice.customer as string)
      if (error) { console.error('[webhook] invoice.payment_failed error:', error); dbError = error }
      break
    }
  }

  if (dbError) {
    // 500 → Stripe rejoue le webhook plus tard (évite les états silencieusement perdus)
    return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

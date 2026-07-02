import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe, planFromPriceId } from '@/lib/stripe'
import { mapStripeStatus, stripeCancelToIso } from '@/lib/subscription'
import { withErrorHandling } from '@/lib/apiError'
import { logger } from '@/lib/logger'
import type Stripe from 'stripe'

export const POST = withErrorHandling('stripe.webhook', async (req: NextRequest) => {
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    logger.warn('stripe.webhook.bad_signature', {}, err)
    return NextResponse.json({ error: 'Webhook signature invalide' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Toute erreur d'écriture DB → on renvoie 500 pour que Stripe réessaie le webhook.
  let dbError: unknown = null

  switch (event.type) {
    case 'checkout.session.completed': {
      const session  = event.data.object as Stripe.Checkout.Session
      const washerId = session.metadata?.washer_id
      const plan     = session.metadata?.plan
      if (!washerId || !plan) break

      // On écrit toujours 'active' ici ; si le checkout était en période d'essai
      // (facturation différée), Stripe envoie ensuite un customer.subscription.updated
      // avec status 'trialing' qui corrige le statut en 'trial' via mapStripeStatus.
      const { error } = await admin.from('washers').update({
        stripe_customer_id:     session.customer as string,
        stripe_subscription_id: session.subscription as string,
        plan,
        subscription_status:    'active',
        cancels_at:             null,
      }).eq('id', washerId)
      if (error) { logger.error('stripe.webhook.checkout_completed.db', { washerId }, error); dbError = error }
      else logger.info('stripe.webhook.checkout_completed', { washerId, plan })
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

      if (error) { logger.error('stripe.webhook.subscription_updated.db', { subId: sub.id }, error); dbError = error }
      else if (!data || data.length === 0) {
        // Fallback : la ligne n'a pas encore stripe_subscription_id → matcher sur customer
        const { error: err2 } = await admin.from('washers').update({
          ...(plan ? { plan } : {}),
          stripe_subscription_id: sub.id,
          subscription_status: status,
          cancels_at: cancelsAt,
        }).eq('stripe_customer_id', sub.customer as string)
        if (err2) { logger.error('stripe.webhook.subscription_updated.fallback.db', { subId: sub.id }, err2); dbError = err2 }
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
      if (error) { logger.error('stripe.webhook.subscription_deleted.db', { subId: sub.id }, error); dbError = error }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const sub = invoice.parent?.subscription_details?.subscription
      const subId = typeof sub === 'string' ? sub : (sub?.id ?? null)
      if (!subId) break
      const { error } = await admin.from('washers').update({
        subscription_status: 'past_due',
      }).eq('stripe_subscription_id', subId)
      if (error) { logger.error('stripe.webhook.invoice_payment_failed.db', { subId }, error); dbError = error }
      break
    }
  }

  if (dbError) {
    // 500 → Stripe rejoue le webhook plus tard (évite les états silencieusement perdus)
    return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
})

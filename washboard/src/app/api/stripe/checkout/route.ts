import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe, STRIPE_PRICE_IDS } from '@/lib/stripe'
import type { Plan } from '@/lib/plan'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { plan } = await req.json() as { plan: Plan }
  const priceId = STRIPE_PRICE_IDS[plan]
  if (!priceId) return NextResponse.json({ error: 'Plan invalide' }, { status: 400 })

  const { data: washer } = await supabase
    .from('washers')
    .select('id, stripe_customer_id')
    .eq('user_id', user.id)
    .single()
  if (!washer) return NextResponse.json({ error: 'Laveur introuvable' }, { status: 404 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    ...(washer.stripe_customer_id
      ? { customer: washer.stripe_customer_id }
      : { customer_email: user.email ?? undefined }
    ),
    client_reference_id: user.id,
    metadata: { washer_id: washer.id, plan },
    success_url: `${appUrl}/dashboard/abonnement?success=1`,
    cancel_url:  `${appUrl}/dashboard/abonnement?cancelled=1`,
  })

  return NextResponse.json({ url: session.url })
}

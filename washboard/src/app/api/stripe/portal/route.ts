import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: washer } = await supabase
    .from('washers')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .single()

  if (!washer?.stripe_customer_id) {
    return NextResponse.json({ error: 'Aucun abonnement Stripe actif' }, { status: 400 })
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: washer.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/abonnement`,
  })

  return NextResponse.json({ url: session.url })
}

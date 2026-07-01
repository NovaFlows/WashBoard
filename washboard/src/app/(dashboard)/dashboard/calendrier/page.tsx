import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import CalendrierDashboard from '@/components/dashboard/CalendrierDashboard'

export default async function CalendrierPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: washer } = await supabase
    .from('washers').select('*').eq('user_id', user.id).single()
  if (!washer) redirect('/login')

  const [
    { data: bookings },
    { data: unavailabilities },
    { data: services },
    { data: categories },
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select('*, services(name, price, duration_minutes)')
      .eq('washer_id', washer.id)
      .order('scheduled_at', { ascending: true }),
    supabase
      .from('unavailabilities')
      .select('*')
      .eq('washer_id', washer.id)
      .order('start_date'),
    supabase
      .from('services')
      .select('*')
      .eq('washer_id', washer.id)
      .order('created_at'),
    supabase
      .from('service_categories')
      .select('*')
      .eq('washer_id', washer.id)
      .order('display_order'),
  ])

  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null}>
      <CalendrierDashboard
        bookings={bookings ?? []}
        unavailabilities={unavailabilities ?? []}
        teamSize={washer.team_size ?? 1}
        services={services ?? []}
        categories={categories ?? []}
        washerId={washer.id}
      />
    </DashboardShell>
  )
}

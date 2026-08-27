import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import CrmDashboard from '@/components/dashboard/CrmDashboard'
import VisitFunnel from '@/components/dashboard/VisitFunnel'
import { buildFunnelSummary } from '@/lib/funnelStats'
import { logger } from '@/lib/logger'

const FUNNEL_WINDOW_DAYS = 30

export default async function CrmPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: washer } = await supabase
    .from('washers').select('*').eq('user_id', user.id).single()
  if (!washer) redirect('/login')

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, services(name, price, duration_minutes)')
    .eq('washer_id', washer.id)
    .order('created_at', { ascending: false })

  const since = new Date()
  since.setDate(since.getDate() - FUNNEL_WINDOW_DAYS)
  const { data: funnelEvents, error: funnelError } = await supabase
    .from('booking_funnel_events')
    .select('step, session_id')
    .eq('washer_id', washer.id)
    .gte('created_at', since.toISOString())

  // Sans trace ici, un `?? []` silencieux ferait apparaître un entonnoir vide
  // sans que personne ne remarque que la lecture a échoué (RLS, GRANT...).
  if (funnelError) logger.warn('crm.funnel_events.fetch_failed', { washerId: washer.id }, funnelError)
  const funnelStats = buildFunnelSummary(funnelEvents ?? [])

  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null}>
      <div className="mb-6">
        <VisitFunnel stats={funnelStats} accent={washer.brand_color ?? undefined} windowDays={FUNNEL_WINDOW_DAYS} />
      </div>
      <CrmDashboard bookings={bookings ?? []} />
    </DashboardShell>
  )
}

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import CrmDashboard from '@/components/dashboard/CrmDashboard'
import VisitFunnel from '@/components/dashboard/VisitFunnel'
import FunnelInsights from '@/components/dashboard/FunnelInsights'
import {
  buildFunnelSummary,
  countDistinctSessions,
  buildDeviceBreakdown,
  buildReferrerBreakdown,
  estimatePeakConcurrentSessions,
  comparePeriods,
} from '@/lib/funnelStats'
import { logger } from '@/lib/logger'

const FUNNEL_WINDOW_DAYS = 30
const PEAK_SHORT_WINDOW_DAYS = 7

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
  const previousSince = new Date(since)
  previousSince.setDate(previousSince.getDate() - FUNNEL_WINDOW_DAYS)
  const shortWindowSince = new Date()
  shortWindowSince.setDate(shortWindowSince.getDate() - PEAK_SHORT_WINDOW_DAYS)

  const { data: funnelEvents, error: funnelError } = await supabase
    .from('booking_funnel_events')
    .select('step, session_id, created_at, referrer_host, device')
    .eq('washer_id', washer.id)
    .gte('created_at', since.toISOString())

  // Sans trace ici, un `?? []` silencieux ferait apparaître un entonnoir vide
  // sans que personne ne remarque que la lecture a échoué (RLS, GRANT...).
  if (funnelError) logger.warn('crm.funnel_events.fetch_failed', { washerId: washer.id }, funnelError)
  const events = funnelEvents ?? []
  const funnelStats = buildFunnelSummary(events)

  // Requête dédiée et légère pour la période de comparaison précédente
  // (seule la présence à l'étape "prestation" nous intéresse ici).
  const { data: previousPeriodEvents, error: previousPeriodError } = await supabase
    .from('booking_funnel_events')
    .select('session_id')
    .eq('washer_id', washer.id)
    .eq('step', 'prestation')
    .gte('created_at', previousSince.toISOString())
    .lt('created_at', since.toISOString())

  if (previousPeriodError) logger.warn('crm.funnel_events.previous_period_fetch_failed', { washerId: washer.id }, previousPeriodError)

  const visitorCount = funnelStats.find(s => s.step === 'prestation')?.sessions ?? 0
  const conversionRate = funnelStats.find(s => s.step === 'confirmation')?.pctOfFirst ?? 0
  const previousVisitorCount = countDistinctSessions(previousPeriodEvents ?? [])
  const visitorChange = comparePeriods(visitorCount, previousVisitorCount)
  const deviceBreakdown = buildDeviceBreakdown(events)
  const referrerBreakdown = buildReferrerBreakdown(events)
  const peak7d = estimatePeakConcurrentSessions(events.filter(e => new Date(e.created_at) >= shortWindowSince))
  const peak30d = estimatePeakConcurrentSessions(events)

  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null}>
      <div className="mb-6 space-y-4">
        <FunnelInsights
          visitorCount={visitorCount}
          visitorChange={visitorChange}
          conversionRate={conversionRate}
          peak7d={peak7d}
          peak30d={peak30d}
          deviceBreakdown={deviceBreakdown}
          referrerBreakdown={referrerBreakdown}
          accent={washer.brand_color ?? undefined}
          windowDays={FUNNEL_WINDOW_DAYS}
        />
        <VisitFunnel stats={funnelStats} accent={washer.brand_color ?? undefined} windowDays={FUNNEL_WINDOW_DAYS} />
      </div>
      <CrmDashboard bookings={bookings ?? []} />
    </DashboardShell>
  )
}

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import ComptaDashboard from '@/components/dashboard/ComptaDashboard'
import { UpgradePrompt } from '@/components/dashboard/UpgradePrompt'
import { hasFeature, requiredPlanLabel } from '@/lib/plan'
import { toutesLesLignes } from '@/lib/supabase/toutesLesLignes'
import { logger } from '@/lib/logger'
import { washerDuUtilisateur } from '@/lib/washerCourant'
import { revenuNet } from '@/lib/pricing'

export default async function ComptaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const washer = await washerDuUtilisateur(supabase, user.id, 'compta')

  // La comptabilité fait partie du plan Pro (et au-dessus)
  if (!hasFeature(washer, 'compta')) {
    return (
      <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null} betaRefonte={washer.beta_refonte}>
        <div className="p-4">
          <div className="mb-6">
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Comptabilité</h1>
          </div>
          <UpgradePrompt
            title="Gérez votre comptabilité"
            description="Suivez votre chiffre d'affaires, vos dépenses et votre résultat chaque mois. Disponible à partir du plan Pro."
            planLabel={requiredPlanLabel('compta')}
          />
        </div>
      </DashboardShell>
    )
  }

  // Revenus du mois courant pour le SSR initial
  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1
  const start = `${year}-${String(month).padStart(2, '0')}-01T00:00:00`
  const end   = new Date(year, month, 1).toISOString().slice(0, 10) + 'T00:00:00'

  // Page par page : l'API coupe à 1 000 lignes sans erreur (voir `toutesLesLignes`).
  const { data: bookings, error: bookingsError } = await toutesLesLignes((debut, fin) => supabase
    .from('bookings')
    .select('booked_price, smart_discount, is_smart_slot')
    .eq('washer_id', washer.id)
    .eq('status', 'done')
    .gte('scheduled_at', start)
    .lt('scheduled_at', end)
    .order('scheduled_at')
    .order('id')
    .range(debut, fin))
  // Sans trace, un chiffre d'affaires à 0 € ne se distinguerait pas d'un mois sans activité.
  if (bookingsError) logger.error('compta.bookings.fetch_failed', { washerId: washer.id }, bookingsError)

  const initialRevenue = revenuNet(bookings ?? [])

  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null} betaRefonte={washer.beta_refonte}>
      <div className="p-4 max-w-2xl mx-auto">
        <div className="mb-5">
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Comptabilité</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">CA et dépenses par mois</p>
        </div>
        <ComptaDashboard initialRevenue={initialRevenue} washerId={washer.id} />
      </div>
    </DashboardShell>
  )
}

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import ParametresForm from '@/components/dashboard/ParametresForm'
import { SetupProgressBar } from '@/components/dashboard/SetupProgressBar'
import { computeSetupProgress } from '@/lib/setupProgress'
import { logger } from '@/lib/logger'

export default async function ParametresPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: washer } = await supabase
    .from('washers')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!washer) redirect('/login')

  // Deux comptages seulement, en tête : on ne rapatrie pas les lignes elles-mêmes.
  const [services, availabilities] = await Promise.all([
    supabase.from('services').select('id', { count: 'exact', head: true }).eq('washer_id', washer.id),
    supabase.from('availabilities').select('id', { count: 'exact', head: true }).eq('washer_id', washer.id),
  ])

  // Un échec de lecture ne doit pas inventer un compte vide : le laveur verrait
  // « 0 % » et une liste de choses à faire déjà faites. On compte alors ces
  // éléments comme présents — la barre disparaît plutôt que de mentir.
  if (services.error) logger.warn('parametres.services_count_failed', { washerId: washer.id }, services.error)
  if (availabilities.error) logger.warn('parametres.availabilities_count_failed', { washerId: washer.id }, availabilities.error)

  const progress = computeSetupProgress({
    servicesCount: services.error ? 1 : (services.count ?? 0),
    availabilitiesCount: availabilities.error ? 1 : (availabilities.count ?? 0),
    baseAddress: washer.base_address ?? null,
    phone: washer.phone ?? null,
    logoUrl: washer.logo_url ?? null,
  })

  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Paramètres</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Gérez vos informations et votre page client</p>
      </div>
      <div className="mb-4">
        <SetupProgressBar progress={progress} />
      </div>
      <ParametresForm washer={washer} email={user.email ?? ''} />
    </DashboardShell>
  )
}

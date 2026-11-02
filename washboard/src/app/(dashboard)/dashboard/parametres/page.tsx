import { createClient } from '@/lib/supabase/server'
import { washerDuUtilisateur } from '@/lib/washerCourant'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import ParametresForm from '@/components/dashboard/ParametresForm'
import { EnteteParametres } from '@/components/dashboard/EnteteParametres'
import { resumeHorairesCourt } from '@/lib/horaires'
import { logger } from '@/lib/logger'

export default async function ParametresPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const washer = await washerDuUtilisateur(supabase, user.id, 'parametres')

  // Prestations comptées (nombre de la ligne « Prestations et prix »), plages d'ouverture
  // lues pour la phrase de résumé de la ligne « Horaires ».
  const [services, availabilities] = await Promise.all([
    supabase.from('services').select('id', { count: 'exact', head: true }).eq('washer_id', washer.id),
    supabase.from('availabilities').select('day_of_week, start_time, end_time').eq('washer_id', washer.id),
  ])

  if (services.error) logger.warn('parametres.services_count_failed', { washerId: washer.id }, services.error)
  if (availabilities.error) logger.warn('parametres.availabilities_count_failed', { washerId: washer.id }, availabilities.error)

  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} subscriptionEndsAt={washer.subscription_ends_at ?? null} createdAt={washer.created_at} slug={washer.slug} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null} betaRefonte={washer.beta_refonte}>
      <EnteteParametres />
      {/* `undefined` si la lecture a échoué : ligne affichée sans nombre plutôt qu'un zéro inventé. */}
      <ParametresForm
        washer={washer}
        email={user.email ?? ''}
        servicesCount={services.error ? undefined : (services.count ?? 0)}
        resumeHoraires={availabilities.error ? undefined : resumeHorairesCourt(availabilities.data ?? [])}
        betaRefonte={washer.beta_refonte}
      />
    </DashboardShell>
  )
}

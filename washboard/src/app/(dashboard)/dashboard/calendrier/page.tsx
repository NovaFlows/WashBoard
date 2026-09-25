import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import CalendrierDashboard from '@/components/dashboard/CalendrierDashboard'
import { toutesLesLignes } from '@/lib/supabase/toutesLesLignes'
import { logger } from '@/lib/logger'
import { infosFacturationManquantes } from '@/lib/facture'
import { washerDuUtilisateur } from '@/lib/washerCourant'

export default async function CalendrierPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const washer = await washerDuUtilisateur(supabase, user.id, 'calendrier')

  const [
    { data: bookings, error: bookingsError },
    { data: unavailabilities, error: errConges },
    { data: services, error: errServices },
    { data: categories, error: errCategories },
  ] = await Promise.all([
    // Lues page par page : l'API plafonne chaque réponse à 1 000 lignes, sans
    // erreur. Voir `toutesLesLignes`. Tri complété par `id` : une clé unique,
    // sinon deux pages successives peuvent se chevaucher.
    toutesLesLignes((debut, fin) => supabase
      .from('bookings')
      .select('*, services(name, price, duration_minutes, service_categories(name))')
      .eq('washer_id', washer.id)
      .order('scheduled_at', { ascending: true })
      .order('id')
      .range(debut, fin)),
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
  // Sans trace, un calendrier vide ou incomplet ne se distinguerait pas d'un
  // calendrier sans rendez-vous.
  if (bookingsError) logger.error('calendrier.bookings.fetch_failed', { washerId: washer.id }, bookingsError)
  // Congés, prestations et catégories : en échec, le calendrier affiche une
  // journée libre et des listes vides — donc un laveur qui pourrait accepter un
  // rendez-vous pendant ses congés, sans qu'aucune trace n'existe.
  for (const [table, erreur] of [
    ['unavailabilities', errConges], ['services', errServices], ['service_categories', errCategories],
  ] as const) {
    if (erreur) logger.error('calendrier.read_failed', { washerId: washer.id, table }, erreur)
  }

  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null} betaRefonte={washer.beta_refonte}>
      {/* useSearchParams (lecture de ?rdv=, quand on arrive depuis une
          notification) exige une limite Suspense, sinon le build échoue. */}
      <Suspense fallback={null}>
        <CalendrierDashboard
          bookings={bookings ?? []}
          unavailabilities={unavailabilities ?? []}
          teamSize={washer.team_size ?? 1}
          services={services ?? []}
          categories={categories ?? []}
          washerId={washer.id}
          facturationPrete={infosFacturationManquantes(washer).length === 0}
          // Un booléen, jamais le jeton : tout ce qui passe ici est sérialisé dans la page.
          googleAgendaConnecte={!!washer.google_refresh_token}
        />
      </Suspense>
    </DashboardShell>
  )
}

import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import CalendrierDashboard from '@/components/dashboard/CalendrierDashboard'
import { toutesLesLignes } from '@/lib/supabase/toutesLesLignes'
import { logger } from '@/lib/logger'
import { infosFacturationManquantes } from '@/lib/facture'
import { washerDuUtilisateur } from '@/lib/washerCourant'
import { quotaReservations } from '@/lib/plan'
import { seuilsVerrouillage, masquerVerrouillees } from '@/lib/reservationsVerrouillees'
import { JoursClientsMasques } from '@/components/dashboard/JoursClientsMasques'

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

  // ── Réservations au-delà du quota : visibles, mais muettes ──────────────
  //
  // Le masquage se fait ICI, au sortir de la base : un composant qui
  // oublierait la règle afficherait le vrai nom du client. À cet endroit,
  // l'oubli est impossible — la donnée n'existe déjà plus.
  const seuils = await seuilsVerrouillage(supabase, washer, quotaReservations(washer))
  const marquees = masquerVerrouillees(bookings ?? [], seuils)
  const visibles = marquees.filter(b => !b.verrouillee)
  // Les journées concernées, pour le bandeau au-dessus de l'agenda. Le jour
  // seul, jamais l'heure : la grille horaire, elle, ne les reçoit pas.
  //
  // Restreint à ce qui n'a pas encore eu lieu : un agenda sert à organiser ce
  // qui vient. Lister les journées passées ferait un bandeau de quarante
  // lignes sur des rendez-vous perdus — un reproche, pas une occasion.
  //
  // MÊME définition que le bandeau de l'accueil : les rendez-vous ni clôturés
  // ni annulés, sans filtre de date. Un critère « à partir d'aujourd'hui »
  // paraissait plus logique pour un agenda, mais il donnait un client ici et
  // trois sur l'accueil — deux chiffres pour la même chose sur deux écrans
  // voisins, et c'est le produit entier qu'on cesse de croire. Un rendez-vous
  // passé mais jamais clôturé reste d'ailleurs un client à récupérer.
  const joursMasques = marquees
    .filter(b => b.verrouillee && b.scheduled_at && !['done', 'cancelled'].includes(b.status as string))
    .map(b => b.scheduled_at as string)

  // Congés, prestations et catégories : en échec, le calendrier affiche une
  // journée libre et des listes vides — donc un laveur qui pourrait accepter un
  // rendez-vous pendant ses congés, sans qu'aucune trace n'existe.
  for (const [table, erreur] of [
    ['unavailabilities', errConges], ['services', errServices], ['service_categories', errCategories],
  ] as const) {
    if (erreur) logger.error('calendrier.read_failed', { washerId: washer.id, table }, erreur)
  }

  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} createdAt={washer.created_at} slug={washer.slug} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null}>
      {/* useSearchParams (lecture de ?rdv=, quand on arrive depuis une
          notification) exige une limite Suspense, sinon le build échoue. */}
      <JoursClientsMasques dates={joursMasques} />

      <Suspense fallback={null}>
        {/* Les réservations verrouillées ne figurent PAS dans l'agenda : une
            grille horaire ne sait pas placer un rendez-vous dont on cache
            l'heure, et l'y poser la révélerait. Le laveur les retrouve sur son
            accueil, avec le nom et le jour. Elles sont en attente et il ne peut
            pas les confirmer : son agenda ne perd donc aucun engagement réel. */}
        <CalendrierDashboard
          bookings={visibles}
          unavailabilities={unavailabilities ?? []}
          teamSize={washer.team_size ?? 1}
          services={services ?? []}
          categories={categories ?? []}
          washerId={washer.id}
          facturationPrete={infosFacturationManquantes(washer).length === 0}
        />
      </Suspense>
    </DashboardShell>
  )
}

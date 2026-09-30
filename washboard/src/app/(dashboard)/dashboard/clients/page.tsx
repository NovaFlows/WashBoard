import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import ClientsView from '@/components/dashboard/ClientsView'
import { logger } from '@/lib/logger'
import { toutesLesLignes } from '@/lib/supabase/toutesLesLignes'
import type { ClientBooking } from '@/lib/clientProfile'
import { washerDuUtilisateur } from '@/lib/washerCourant'
import { quotaReservations, planEffectif, offreQuiCouvre, PLAN_LABELS } from '@/lib/plan'
import { seuilsVerrouillage, masquerVerrouillees, compterReservationsDeLaPeriode, montantVerrouille } from '@/lib/reservationsVerrouillees'

// Fichier clients : tiré des réservations, un client par email (voir
// lib/listeClients.ts). Seules les colonnes utiles à la liste et à la fiche
// partent vers le navigateur — ni notes internes, ni contenu des factures.
// `created_at` sert au verrouillage des reservations hors quota : sans lui,
// la regle ne peut rien trancher et l'annuaire les afficherait toutes.
const COLONNES = 'id, created_at, client_name, client_email, client_phone, address, scheduled_at, status, closed_late, booked_price, is_professional, company_name, services(name, price, duration_minutes)'

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const washer = await washerDuUtilisateur(supabase, user.id, 'clients')

  // Page par page : l'API coupe à 1 000 lignes sans erreur (voir `toutesLesLignes`).
  const { data: bookings, error } = await toutesLesLignes(
    (debut, fin) => supabase
      .from('bookings')
      .select(COLONNES)
      .eq('washer_id', washer.id)
      .order('scheduled_at', { ascending: false })
      .order('id')
      .range(debut, fin),
  )
  // Sans trace, un fichier vide ne se distinguerait pas d'un laveur sans client.
  if (error) logger.error('clients.bookings.fetch_failed', { washerId: washer.id }, error)

  // Réservations au-delà du quota. Elles ne rejoignent PAS l'annuaire : celui-ci
  // regroupe par email, et ces réservations n'en ont pas — elles se fondraient
  // toutes en une seule fiche fantôme. Elles ont donc leur propre carte,
  // au-dessus, avec le nom flouté et le jour.
  const seuils = await seuilsVerrouillage(supabase, washer, quotaReservations(washer))
  const montantBloque = montantVerrouille(bookings, seuils)
  const marquees = masquerVerrouillees(bookings, seuils)
  const visibles = marquees.filter(b => !b.verrouillee)
  const bloquees = marquees
    .filter(b => b.verrouillee)
    .map(b => ({ id: b.id as string, client_name: b.client_name as string | null, scheduled_at: b.scheduled_at as string }))

  // L'offre proposée dépend du VOLUME du mois, pas du simple fait d'être
  // bloqué : à sept réservations sur une offre plafonnée à cinq, le Starter
  // suffit et coûte trente euros de moins que le Pro. Le comptage n'a lieu que
  // s'il y a quelque chose à débloquer — sinon c'est une requête pour rien sur
  // chaque affichage de la page.
  const volumeDuMois = bloquees.length === 0 ? null : await compterReservationsDeLaPeriode(supabase, washer)
  const offreProposee = offreQuiCouvre(planEffectif(washer), volumeDuMois)


  // Le typage déduit une LISTE pour la jointure `services`, mais PostgREST
  // renvoie un objet : une réservation n'a qu'une prestation. On accepte les
  // deux formes plutôt que de forcer le type.
  const lignes: ClientBooking[] = visibles.map(b => ({
    ...b,
    services: (Array.isArray(b.services) ? b.services[0] : b.services) ?? null,
  }))

  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} createdAt={washer.created_at} slug={washer.slug} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null}>
      <ClientsView
        bookings={lignes}
        bloques={bloquees}
        offreDeblocage={PLAN_LABELS[offreProposee]}
        montantBloque={montantBloque}
      />
    </DashboardShell>
  )
}

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import ClientsView from '@/components/dashboard/ClientsView'
import { logger } from '@/lib/logger'
import { toutesLesLignes } from '@/lib/supabase/toutesLesLignes'
import type { ClientBooking } from '@/lib/clientProfile'
import { washerDuUtilisateur } from '@/lib/washerCourant'

// Fichier clients : tiré des réservations, un client par email (voir
// lib/listeClients.ts). Seules les colonnes utiles à la liste et à la fiche
// partent vers le navigateur — ni notes internes, ni contenu des factures.
const COLONNES = 'id, client_name, client_email, client_phone, address, scheduled_at, status, closed_late, booked_price, is_professional, company_name, services(name, price, duration_minutes)'

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

  // Le typage déduit une LISTE pour la jointure `services`, mais PostgREST
  // renvoie un objet : une réservation n'a qu'une prestation. On accepte les
  // deux formes plutôt que de forcer le type.
  const lignes: ClientBooking[] = bookings.map(b => ({
    ...b,
    services: (Array.isArray(b.services) ? b.services[0] : b.services) ?? null,
  }))

  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null}>
      <ClientsView bookings={lignes} />
    </DashboardShell>
  )
}

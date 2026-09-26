import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import Chiffres from '@/components/dashboard/Chiffres'
import { hasFeature, requiredPlanLabel } from '@/lib/plan'
import { normalizeHost } from '@/lib/funnelStats'
import { toutesLesLignes } from '@/lib/supabase/toutesLesLignes'
import { logger } from '@/lib/logger'
import { washerDuUtilisateur } from '@/lib/washerCourant'

// Refonte 2026, passe 5 — « Chiffres » fusionne l'ancien CRM (/dashboard/crm)
// et la Comptabilité (/dashboard/compta) en une seule destination à 3 onglets
// (Argent · Acquisition · Clients), réservée à la PWA installée (voir
// Chiffres.tsx, le garde-fou). /dashboard/crm et /dashboard/compta restent
// intacts : cette page ne les modifie pas, elle vit à une route neuve — voir
// le compte rendu de la passe pour pourquoi CrmDashboard/ComptaDashboard ne
// deviennent pas des points de branchement v1/v2.
//
// Même fenêtre d'événements que /dashboard/crm : au-delà, les statistiques de
// visite n'existent pas.
const FUNNEL_HISTORY_DAYS = 365

export default async function ChiffresPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const washer = await washerDuUtilisateur(supabase, user.id, 'chiffres')

  // Réservations complètes, avec le service joint : sert à la fois à
  // l'onglet Clients (meilleurs clients, répartition pro/particulier) et,
  // plus tard, à un export — même requête que CrmPage. Lues page par page :
  // l'API plafonne chaque réponse à 1 000 lignes, sans erreur.
  const { data: bookings, error: bookingsError } = await toutesLesLignes(
    (debut, fin) => supabase
      .from('bookings')
      .select('*, services(name, price, duration_minutes)')
      .eq('washer_id', washer.id)
      .order('created_at', { ascending: false })
      .order('id')
      .range(debut, fin),
  )
  if (bookingsError) logger.warn('chiffres.bookings.fetch_failed', { washerId: washer.id }, bookingsError)

  const since = new Date()
  since.setDate(since.getDate() - FUNNEL_HISTORY_DAYS)

  // Sert à l'onglet Acquisition. Sans trace ici, un `?? []` silencieux ferait
  // apparaître un entonnoir vide sans que personne ne remarque que la lecture
  // a échoué (RLS, GRANT...) — même risque que sur /dashboard/crm.
  const { data: funnelEvents, error: funnelError } = await toutesLesLignes(
    (debut, fin) => supabase
      .from('booking_funnel_events')
      .select('step, session_id, created_at, referrer_host, device')
      .eq('washer_id', washer.id)
      .gte('created_at', since.toISOString())
      .order('created_at')
      .order('id')
      .range(debut, fin),
  )
  if (funnelError) logger.warn('chiffres.funnel_events.fetch_failed', { washerId: washer.id }, funnelError)

  // Compte léger, pour la ligne « Factures · N émises » de l'onglet Argent —
  // même filtre que /dashboard/factures (`facture_numero` non nul), sans
  // recharger la liste complète des factures ici.
  const { count: facturesCount, error: facturesError } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('washer_id', washer.id)
    .not('facture_numero', 'is', null)
  if (facturesError) logger.warn('chiffres.factures_count.fetch_failed', { washerId: washer.id }, facturesError)

  const websiteHost = washer.website_url ? normalizeHost(washer.website_url) : undefined

  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null} betaRefonte={washer.beta_refonte}>
      <Chiffres
        bookings={bookings ?? []}
        events={funnelEvents ?? []}
        websiteHost={websiteHost}
        hasCompta={hasFeature(washer, 'compta')}
        comptaPlanLabel={requiredPlanLabel('compta')}
        facturesCount={facturesCount ?? 0}
        evenementsDepuis={since.toISOString()}
        reservationsIncompletes={!!bookingsError}
        evenementsIncomplets={!!funnelError}
      />
    </DashboardShell>
  )
}

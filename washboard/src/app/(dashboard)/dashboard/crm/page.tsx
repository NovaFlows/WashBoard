import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import CrmView from '@/components/dashboard/CrmView'
import TrafficSourceLinks from '@/components/dashboard/TrafficSourceLinks'
import { SITE_URL_FALLBACK } from '@/lib/plan'
import { normalizeHost } from '@/lib/funnelStats'
import { logger } from '@/lib/logger'
import { toutesLesLignes } from '@/lib/supabase/toutesLesLignes'

// Fenêtre d'événements chargée. Elle borne ce qu'on peut analyser : au-delà,
// les statistiques de visite n'existent tout simplement pas. Un an couvre les
// périodes proposées par le sélecteur (jour, semaine, mois, année) sans faire
// transiter un volume déraisonnable vers le navigateur.
const FUNNEL_HISTORY_DAYS = 365

export default async function CrmPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: washer } = await supabase
    .from('washers').select('*').eq('user_id', user.id).single()
  if (!washer) redirect('/login')

  // Lues page par page : l'API plafonne chaque réponse à 1 000 lignes, sans
  // erreur. Voir `toutesLesLignes`.
  const { data: bookings, error: bookingsError } = await toutesLesLignes(
    (debut, fin) => supabase
      .from('bookings')
      .select('*, services(name, price, duration_minutes)')
      .eq('washer_id', washer.id)
      .order('created_at', { ascending: false })
      .order('id')
      .range(debut, fin),
  )
  if (bookingsError) logger.warn('crm.bookings.fetch_failed', { washerId: washer.id }, bookingsError)

  const since = new Date()
  since.setDate(since.getDate() - FUNNEL_HISTORY_DAYS)

  // Sans pagination, on ne recevait que les 1 000 premiers événements : chez
  // Kookii Clean, 1 000 sur 5 659, et des statistiques de visite figées au
  // 1er septembre (constaté le 2026-09-12). Ordre stable sur une clé unique,
  // sinon deux pages successives peuvent se chevaucher.
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

  // Sans trace ici, un `?? []` silencieux ferait apparaître un entonnoir vide
  // sans que personne ne remarque que la lecture a échoué (RLS, GRANT...).
  if (funnelError) logger.warn('crm.funnel_events.fetch_failed', { washerId: washer.id }, funnelError)

  const websiteHost = washer.website_url ? normalizeHost(washer.website_url) : undefined

  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null}>
      {/* Les statistiques se calculent désormais dans le navigateur, à partir
          des événements bruts : changer de période ne recharge pas la page, et
          les visites comme les réservations portent sur la même sélection. */}
      <CrmView
        events={funnelEvents ?? []}
        bookings={bookings ?? []}
        websiteHost={websiteHost}
        accent={washer.brand_color ?? undefined}
      />

      {/* Les liens de partage ferment la page : on les copie de temps en
          temps, alors qu'on vient ici pour regarder ses chiffres. En tête,
          ils repoussaient les statistiques sous la ligne de flottaison. */}
      <div className="mt-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">Liens par réseau</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            Partagez le lien correspondant sur chaque réseau pour que la source apparaisse fiablement dans les statistiques ci-dessus, même quand Instagram ou TikTok ne transmettent pas l&apos;origine du clic.
          </p>
          <TrafficSourceLinks baseUrl={`${SITE_URL_FALLBACK}/book/${washer.slug}`} accent={washer.brand_color ?? undefined} />
        </div>
      </div>
    </DashboardShell>
  )
}

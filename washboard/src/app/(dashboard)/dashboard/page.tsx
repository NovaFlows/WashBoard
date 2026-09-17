import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BookingList from '@/components/dashboard/BookingList'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { logger } from '@/lib/logger'
import { computeSetupProgress } from '@/lib/setupProgress'
import { DemarrageCard } from '@/components/dashboard/DemarrageCard'
import { infosFacturationManquantes } from '@/lib/facture'
import { toutesLesLignes } from '@/lib/supabase/toutesLesLignes'

/**
 * Rendez-vous passés affichés sur l'accueil.
 *
 * L'accueil sert à voir ce qui arrive, pas à consulter des archives : le
 * calendrier montre l'historique complet, et la page Clients le regroupe par
 * personne. Vingt suffisent à vérifier ce qu'on vient de terminer.
 */
const HISTORIQUE_AFFICHE = 20

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: washer, error: washerError } = await supabase
    .from('washers')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // Une lecture qui échoue n'est pas un profil absent. Avant, les deux menaient
  // à la déconnexion : un simple raté réseau au réveil de l'application
  // installée fermait la session pour de bon. C'est la page d'ouverture de
  // l'application, la plus exposée. Une erreur affiche désormais l'écran
  // « Réessayer » et la session reste intacte.
  // PGRST116 = aucune ligne : c'est le seul cas où le profil manque vraiment.
  if (washerError && washerError.code !== 'PGRST116') {
    logger.error('dashboard.washer.read_failed', { userId: user.id }, washerError)
    throw new Error('Lecture du profil laveur impossible')
  }

  // Session orpheline (ligne washer supprimée mais session auth encore active) :
  // on déconnecte pour éviter la boucle "profil non trouvé".
  if (!washer) redirect('/api/auth/logout')

  // Tout part en même temps : une seule attente réseau au lieu d'une file.
  //
  // Cette page chargeait TOUT l'historique du laveur, lignes complètes et
  // prestations jointes, pour en tirer trois compteurs et une liste qui
  // affichait le tout. Après deux ans d'activité, c'était des milliers de
  // rendez-vous transférés puis dessinés à chaque ouverture du tableau de bord
  // — la page la plus consultée du produit, et la première ouverte le matin.
  //
  // Désormais : les rendez-vous à venir (ce qu'on vient voir), les derniers
  // terminés (ce qu'on vérifie), et les compteurs comptés par la base, qui
  // restent donc exacts sur tout l'historique sans en rapatrier une ligne.
  const [
    { data: aVenir, error: erreurAVenir },
    historique,
    enAttente,
    confirmes,
    termines,
    services,
    availabilities,
  ] = await Promise.all([
    // Les rendez-vous à venir restent lus en entier : c'est le travail des
    // jours qui viennent, et leur nombre est borné par la nature des choses.
    // `toutesLesLignes` ne coûte rien tant qu'il y en a moins de 1 000.
    toutesLesLignes((debut, fin) => supabase
      .from('bookings')
      .select('*, services(name, price, duration_minutes, service_categories(name))')
      .eq('washer_id', washer.id)
      .not('status', 'in', '(done,cancelled)')
      .order('scheduled_at', { ascending: true })
      .order('id')
      .range(debut, fin)),
    // Les plus récents d'abord : l'historique commençait jusqu'ici par le tout
    // premier rendez-vous du laveur, celui qui l'intéresse le moins.
    supabase
      .from('bookings')
      .select('*, services(name, price, duration_minutes, service_categories(name))')
      .eq('washer_id', washer.id)
      .in('status', ['done', 'cancelled'])
      .order('scheduled_at', { ascending: false })
      .order('id')
      .limit(HISTORIQUE_AFFICHE),
    supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('washer_id', washer.id).eq('status', 'pending'),
    supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('washer_id', washer.id).eq('status', 'confirmed'),
    supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('washer_id', washer.id).eq('status', 'done'),
    supabase.from('services').select('id', { count: 'exact', head: true }).eq('washer_id', washer.id),
    supabase.from('availabilities').select('id', { count: 'exact', head: true }).eq('washer_id', washer.id),
  ])

  // Même règle que dans les Paramètres : un comptage en échec ne doit pas
  // faire croire à un compte vide. On compte l'élément comme présent — la
  // carte de démarrage ne s'affiche pas plutôt que de réclamer à tort.
  if (erreurAVenir) logger.error('dashboard.bookings.fetch_failed', { washerId: washer.id }, erreurAVenir)
  if (historique.error) logger.error('dashboard.historique.fetch_failed', { washerId: washer.id }, historique.error)
  // Sans trace ici, un compteur à zéro se lirait « aucun rendez-vous » alors
  // que c'est la lecture qui a échoué.
  for (const [quoi, erreur] of [
    ['pending', enAttente.error], ['confirmed', confirmes.error], ['done', termines.error],
  ] as const) {
    if (erreur) logger.warn('dashboard.count_failed', { washerId: washer.id, statut: quoi }, erreur)
  }
  if (services.error) logger.warn('dashboard.services_count_failed', { washerId: washer.id }, services.error)
  if (availabilities.error) logger.warn('dashboard.availabilities_count_failed', { washerId: washer.id }, availabilities.error)

  const progress = computeSetupProgress({
    servicesCount: services.error ? 1 : (services.count ?? 0),
    availabilitiesCount: availabilities.error ? 1 : (availabilities.count ?? 0),
    baseAddress: washer.base_address ?? null,
    phone: washer.phone ?? null,
    logoUrl: washer.logo_url ?? null,
    googleCalendarConnected: !!washer.google_refresh_token,
    reviewsEnabled: !!washer.review_enabled,
    followupEnabled: !!washer.followup_enabled,
    zoneEnabled: !!washer.zone_config?.enabled,
    smartSlotEnabled: !!washer.smart_slot_enabled,
    welcomeMessage: washer.welcome_message ?? null,
  })

  const passes = historique.data ?? []
  const all = [...(aVenir ?? []), ...passes]
  const pending = enAttente.count ?? 0
  const confirmed = confirmes.count ?? 0
  const done = termines.count ?? 0

  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null}>
      <DemarrageCard progress={progress} />

      <div className="grid grid-cols-3 gap-3 mb-8">
        <StatCard label="En attente" value={pending} color="amber" />
        <StatCard label="Confirmés" value={confirmed} color="emerald" />
        <StatCard label="Terminés" value={done} color="slate" />
      </div>

      <BookingList
        bookings={all}
        washerId={washer.id}
        facturationPrete={infosFacturationManquantes(washer).length === 0}
        historiqueTronque={passes.length === HISTORIQUE_AFFICHE}
      />
    </DashboardShell>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: 'amber' | 'emerald' | 'slate' }) {
  const colors = {
    amber:   'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400',
    slate:   'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400',
  }
  return (
    <div className={`rounded-xl border p-3 text-center ${colors[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium mt-0.5 opacity-80">{label}</p>
    </div>
  )
}

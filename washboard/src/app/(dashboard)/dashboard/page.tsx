import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BookingList from '@/components/dashboard/BookingList'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { logger } from '@/lib/logger'
import { computeSetupProgress } from '@/lib/setupProgress'
import { DemarrageCard } from '@/components/dashboard/DemarrageCard'
import { infosFacturationManquantes } from '@/lib/facture'
import { toutesLesLignes } from '@/lib/supabase/toutesLesLignes'
import { revenuNet } from '@/lib/pricing'
import { hasFeature } from '@/lib/plan'
import { getPeriodRange } from '@/lib/comptaPeriod'
import { resumeClients } from '@/lib/dashboardClients'
import { widgetsVisibles, type WidgetKey } from '@/lib/dashboardWidgets'
import { countDistinctSessions, buildReferrerBreakdown } from '@/lib/funnelStats'
import { FUSEAU } from '@/lib/dateUtils'
import { AujourdhuiWidget } from '@/components/dashboard/widgets/AujourdhuiWidget'
import { StatsWidget } from '@/components/dashboard/widgets/StatsWidget'
import { ClientsWidget } from '@/components/dashboard/widgets/ClientsWidget'
import { ProchainsRdvWidget } from '@/components/dashboard/widgets/ProchainsRdvWidget'
import { TraficWidget } from '@/components/dashboard/widgets/TraficWidget'
import { PrestationsWidget, type PrestationComptee } from '@/components/dashboard/widgets/PrestationsWidget'
import { ZoneWidget } from '@/components/dashboard/widgets/ZoneWidget'
import { WidgetsConfigurator } from '@/components/dashboard/widgets/WidgetsConfigurator'
import Link from 'next/link'

/**
 * Rendez-vous passés affichés sur l'accueil au premier chargement.
 *
 * L'accueil sert à voir ce qui arrive, pas à consulter des archives : le
 * calendrier montre l'historique complet, et la page Clients le regroupe par
 * personne. Au-delà, un bouton « Charger plus » va chercher la suite à la
 * demande (voir `api/bookings/historique`) plutôt que de tout envoyer d'un coup.
 */
const HISTORIQUE_AFFICHE = 5

/** Requête vide, pour les widgets masqués : ne rien demander à la base plutôt
 *  que de calculer un chiffre qui ne sera affiché nulle part. */
function aucuneLigne<T>(): Promise<{ data: T[]; error: null }> {
  return Promise.resolve({ data: [], error: null })
}

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

  const visibles = widgetsVisibles(washer.dashboard_widgets)
  const mois = getPeriodRange('mois', new Date())

  // Tout part en même temps : une seule attente réseau au lieu d'une file.
  //
  // Cette page chargeait TOUT l'historique du laveur, lignes complètes et
  // prestations jointes, pour en tirer trois compteurs et une liste qui
  // affichait le tout. Après deux ans d'activité, c'était des milliers de
  // rendez-vous transférés puis dessinés à chaque ouverture du tableau de bord
  // — la page la plus consultée du produit, et la première ouverte le matin.
  //
  // Désormais : les rendez-vous à venir (ce qu'on vient voir), les derniers
  // terminés (ce qu'on vérifie), les compteurs comptés par la base, et les
  // widgets — mais SEULEMENT ceux que le laveur a choisi de garder visibles
  // (voir `dashboardWidgets.ts`) : un widget masqué ne coûte plus rien, ni en
  // affichage ni en requête.
  const [
    { data: aVenir, error: erreurAVenir },
    historique,
    statsMois,
    clientsLite,
    visitesLite,
    prestationsMois,
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
    // Widget Statistiques : « en attente »/« confirmés » d'un côté (état
    // actuel, sans borne de temps), le nombre de rendez-vous terminés CE MOIS
    // et le chiffre d'affaires de l'autre — cette seconde requête rend les deux
    // à la fois, pas besoin d'un comptage séparé.
    visibles.has('stats')
      ? Promise.all([
          supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('washer_id', washer.id).eq('status', 'pending'),
          supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('washer_id', washer.id).eq('status', 'confirmed'),
          toutesLesLignes((debut, fin) => supabase
            .from('bookings')
            .select('booked_price, smart_discount, is_smart_slot')
            .eq('washer_id', washer.id)
            .eq('status', 'done')
            .gte('scheduled_at', `${mois.start}T00:00:00`)
            .lte('scheduled_at', `${mois.end}T23:59:59`)
            .order('scheduled_at')
            .order('id')
            .range(debut, fin)),
        ])
      : Promise.resolve(null),
    // Widget Clients : seulement email + date de création, aucune jointure —
    // juste assez pour compter, pas pour réafficher une liste (voir la leçon
    // du 18/09 sur cette même page : ne pas rapatrier des lignes complètes
    // pour un simple chiffre).
    visibles.has('clients')
      ? toutesLesLignes((debut, fin) => supabase
          .from('bookings')
          .select('client_email, created_at')
          .eq('washer_id', washer.id)
          .range(debut, fin))
      : aucuneLigne<{ client_email: string | null; created_at: string }>(),
    // Une seule lecture des événements de visite pour DEUX widgets (Clients ET
    // Trafic), tant que l'un des deux est affiché : même donnée, même mois, pas
    // de raison de la demander deux fois. `step` et `referrer_host` ne servent
    // qu'à Trafic, mais les redemander séparément coûterait un aller-retour de
    // plus pour rien.
    visibles.has('clients') || visibles.has('traffic')
      ? toutesLesLignes((debut, fin) => supabase
          .from('booking_funnel_events')
          .select('session_id, step, referrer_host')
          .eq('washer_id', washer.id)
          .gte('created_at', `${mois.start}T00:00:00`)
          .lte('created_at', `${mois.end}T23:59:59`)
          .range(debut, fin))
      : aucuneLigne<{ session_id: string; step: string; referrer_host: string | null }>(),
    // Widget Prestations : quelle prestation a été la plus demandée ce mois-ci.
    // Compte tout rendez-vous ayant existé (hors annulés) : c'est la demande
    // qu'on mesure, pas seulement ce qui a été facturé.
    visibles.has('services')
      ? toutesLesLignes((debut, fin) => supabase
          .from('bookings')
          .select('services(name)')
          .eq('washer_id', washer.id)
          .neq('status', 'cancelled')
          .gte('scheduled_at', `${mois.start}T00:00:00`)
          .lte('scheduled_at', `${mois.end}T23:59:59`)
          .range(debut, fin))
      : aucuneLigne<{ services: { name: string } | { name: string }[] | null }>(),
    supabase.from('services').select('id', { count: 'exact', head: true }).eq('washer_id', washer.id),
    supabase.from('availabilities').select('id', { count: 'exact', head: true }).eq('washer_id', washer.id),
  ])

  // Même règle que dans les Paramètres : un comptage en échec ne doit pas
  // faire croire à un compte vide. On compte l'élément comme présent — la
  // carte de démarrage ne s'affiche pas plutôt que de réclamer à tort.
  if (erreurAVenir) logger.error('dashboard.bookings.fetch_failed', { washerId: washer.id }, erreurAVenir)
  if (historique.error) logger.error('dashboard.historique.fetch_failed', { washerId: washer.id }, historique.error)
  if (clientsLite.error) logger.warn('dashboard.clients_widget.fetch_failed', { washerId: washer.id }, clientsLite.error)
  if (visitesLite.error) logger.warn('dashboard.visiteurs_widget.fetch_failed', { washerId: washer.id }, visitesLite.error)
  if (prestationsMois.error) logger.warn('dashboard.prestations_widget.fetch_failed', { washerId: washer.id }, prestationsMois.error)
  if (services.error) logger.warn('dashboard.services_count_failed', { washerId: washer.id }, services.error)
  if (availabilities.error) logger.warn('dashboard.availabilities_count_failed', { washerId: washer.id }, availabilities.error)

  let pending = 0
  let confirmed = 0
  let terminesCeMois = 0
  let caCeMois = 0
  if (statsMois) {
    const [enAttente, confirmes, doneMois] = statsMois
    if (enAttente.error) logger.warn('dashboard.count_failed', { washerId: washer.id, statut: 'pending' }, enAttente.error)
    if (confirmes.error) logger.warn('dashboard.count_failed', { washerId: washer.id, statut: 'confirmed' }, confirmes.error)
    if (doneMois.error) logger.warn('dashboard.count_failed', { washerId: washer.id, statut: 'done_mois' }, doneMois.error)
    pending = enAttente.count ?? 0
    confirmed = confirmes.count ?? 0
    terminesCeMois = doneMois.data.length
    caCeMois = revenuNet(doneMois.data)
  }

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

  // Aujourd'hui, à l'heure de Paris — calculé sur `aVenir` (déjà en main, déjà
  // trié par heure croissante), sans requête de plus. Ne montre que ce qui
  // reste à faire : un rendez-vous déjà clôturé n'a plus rien à demander.
  const aujourdhui = new Date().toLocaleDateString('en-CA', { timeZone: FUSEAU })
  const rdvAujourdhui = (aVenir ?? []).filter(
    b => new Date(b.scheduled_at).toLocaleDateString('en-CA', { timeZone: FUSEAU }) === aujourdhui,
  )
  // Après aujourd'hui, pour ne pas doublonner le widget ci-dessus : les trois
  // prochains, dans l'ordre où `aVenir` est déjà trié.
  const rdvProchains = (aVenir ?? [])
    .filter(b => new Date(b.scheduled_at).toLocaleDateString('en-CA', { timeZone: FUSEAU }) !== aujourdhui)
    .slice(0, 3)

  const resumeClientsWidget = resumeClients(clientsLite.data ?? [], mois.start)
  const visiteursCeMois = countDistinctSessions(visitesLite.data ?? [])

  // Widget Trafic : sessions ayant atteint « confirmation » (une réservation
  // vraiment déposée), rapportées aux visiteurs — exactement le calcul de la
  // page CRM (voir FunnelInsights/CrmView), aux deux premières sources.
  const conversionsCeMois = new Set(
    (visitesLite.data ?? []).filter(e => e.step === 'confirmation').map(e => e.session_id),
  ).size
  const sourcesCeMois = buildReferrerBreakdown(visitesLite.data ?? []).slice(0, 2)

  // Widget Prestations : un décompte par nom, le plus demandé en tête. La
  // jointure `services` est parfois un objet, parfois un tableau selon ce que
  // déduit le typage généré — les deux formes sont acceptées (même motif que
  // sur la page Clients).
  const comptePrestations = new Map<string, number>()
  for (const b of prestationsMois.data ?? []) {
    const svc = Array.isArray(b.services) ? b.services[0] : b.services
    const nom = svc?.name ?? 'Prestation'
    comptePrestations.set(nom, (comptePrestations.get(nom) ?? 0) + 1)
  }
  const prestationsComptees: PrestationComptee[] = [...comptePrestations.entries()]
    .map(([nom, nombre]) => ({ nom, nombre }))
    .sort((a, b) => b.nombre - a.nombre)

  // Un widget par clé, prêt à afficher — construits une fois, puis piochés
  // dans l'ORDRE choisi par le laveur (voir WidgetsConfigurator : l'ordre du
  // tableau `dashboard_widgets` EST l'ordre d'affichage).
  const widgetsParCle: Record<WidgetKey, ReactNode> = {
    today: <AujourdhuiWidget bookings={rdvAujourdhui} />,
    stats: (
      <StatsWidget
        pending={pending}
        confirmed={confirmed}
        terminesCeMois={terminesCeMois}
        caCeMois={hasFeature(washer, 'compta') ? caCeMois : null}
      />
    ),
    clients: (
      <ClientsWidget
        total={resumeClientsWidget.total}
        nouveauxCeMois={resumeClientsWidget.nouveauxCeMois}
        visiteursCeMois={visiteursCeMois}
      />
    ),
    upcoming: <ProchainsRdvWidget bookings={rdvProchains} />,
    traffic: <TraficWidget visiteurs={visiteursCeMois} conversions={conversionsCeMois} sources={sourcesCeMois} />,
    services: <PrestationsWidget prestations={prestationsComptees} />,
    zone: <ZoneWidget zone={washer.zone_config} />,
  }

  const widgetsAffiches = [...visibles]

  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null}>
      <DemarrageCard progress={progress} />

      <div className="flex items-center justify-between gap-2 mb-3">
        {/* Personnaliser la page de réservation vit dans Admin, pas dans les
            widgets — mais y aller à chaque fois n'a rien d'intuitif. Un accès
            direct depuis l'accueil, à côté du réglage des widgets. */}
        <Link
          href="/dashboard/admin#identite"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          Personnaliser ma page
        </Link>
        <WidgetsConfigurator visibles={[...visibles]} />
      </div>

      {widgetsAffiches.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          {widgetsAffiches.map((cle, i) => {
            // Un nombre impair de widgets laisserait le dernier seul sur sa
            // ligne, avec un trou à côté : il prend alors toute la largeur.
            const dernierSeul = i === widgetsAffiches.length - 1 && widgetsAffiches.length % 2 === 1
            return (
              <div key={cle} className={dernierSeul ? 'sm:col-span-2' : ''}>
                {widgetsParCle[cle]}
              </div>
            )
          })}
        </div>
      )}

      <BookingList
        bookings={all}
        washerId={washer.id}
        facturationPrete={infosFacturationManquantes(washer).length === 0}
        historiqueTronque={passes.length === HISTORIQUE_AFFICHE}
      />
    </DashboardShell>
  )
}

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { logger } from '@/lib/logger'
import { computeSetupProgress, etapeDemarrage } from '@/lib/setupProgress'
import { visitesAFaire } from '@/lib/visiteGuidee'
import { DemarrageCard } from '@/components/dashboard/DemarrageCard'
import { toutesLesLignes } from '@/lib/supabase/toutesLesLignes'
import { revenuNet } from '@/lib/pricing'
import { hasFeature, quotaReservations, planEffectif, offreQuiCouvre, PLAN_LABELS, libelleRemiseAZero } from '@/lib/plan'
import { seuilsVerrouillage, masquerVerrouillees, compterReservationsDeLaPeriode } from '@/lib/reservationsVerrouillees'
import { getPeriodRange } from '@/lib/comptaPeriod'
import { getMondayOf, toDateStr } from '@/lib/dateUtils'
import { resumeClients } from '@/lib/dashboardClients'
import { widgetsVisibles } from '@/lib/dashboardWidgets'
import { countDistinctSessions } from '@/lib/funnelStats'
import { FUSEAU } from '@/lib/dateUtils'
import { ajouterJours, bornesInstants, jourParisDe } from '@/lib/chiffresPeriode'
import { semaineAccueil } from '@/lib/semaineAccueil'
import AccueilV2 from '@/components/dashboard/AccueilV2'

/** Derniers rendez-vous clôturés lus : servent à savoir si la journée a commencé. */
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

  // `bookings` se lit par le client admin : le rôle `authenticated` n'y a plus
  // accès, sinon le laveur lisait en direct ce que `masquerVerrouillees` cache.
  // L'admin ignore la RLS — le filtre `washer_id` de chaque requête est donc la
  // SEULE barrière entre deux laveurs.
  const admin = createAdminClient()

  const visibles = widgetsVisibles(washer.dashboard_widgets)
  const mois = getPeriodRange('mois', new Date())
  // Début de la semaine en cours (lundi → maintenant) : sert au widget
  // Clients (nouveaux clients) et au widget Trafic (visiteurs, conversion),
  // même convention que les vues « semaine » de la Comptabilité.
  const lundiCetteSemaine = getMondayOf(new Date())
  // Aujourd'hui à l'heure de Paris — calculé ici, une seule fois, pour servir
  // à la fois à la borne de la requête « Cette semaine » ci-dessous et aux
  // calculs plus bas qui l'utilisaient déjà (journée du jour, à confirmer).
  // Avant cette passe, ce calcul était refait plus loin, après coup : il ne
  // dépend d'aucune donnée chargée, il n'y avait pas de raison d'attendre.
  const aujourdhui = new Date().toLocaleDateString('en-CA', { timeZone: FUSEAU })
  // Bornes Paris de la semaine en cours (lundi 00 h 00 → lundi suivant
  // 00 h 00) — même fonction que l'écran Chiffres (`chiffresPeriode.ts`),
  // jamais un calcul de fuseau réinventé ici.
  const bornesSemaine = bornesInstants({ type: 'semaine', ref: aujourdhui })

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
    visitesSemaine,
    prestationsMois,
    services,
    availabilities,
    rdvSemaine,
  ] = await Promise.all([
    // Les rendez-vous à venir restent lus en entier : c'est le travail des
    // jours qui viennent, et leur nombre est borné par la nature des choses.
    // `toutesLesLignes` ne coûte rien tant qu'il y en a moins de 1 000.
    toutesLesLignes((debut, fin) => admin
      .from('bookings')
      .select('*, services(name, price, duration_minutes, service_categories(name))')
      .eq('washer_id', washer.id)
      .not('status', 'in', '(done,cancelled)')
      .order('scheduled_at', { ascending: true })
      .order('id')
      .range(debut, fin)),
    // Les plus récents d'abord : l'historique commençait jusqu'ici par le tout
    // premier rendez-vous du laveur, celui qui l'intéresse le moins.
    admin
      .from('bookings')
      .select('*, services(name, price, duration_minutes, service_categories(name))')
      .eq('washer_id', washer.id)
      .in('status', ['done', 'cancelled'])
      .order('scheduled_at', { ascending: false })
      .order('id')
      .limit(HISTORIQUE_AFFICHE),
    // Widget Statistiques : rendez-vous terminés CE MOIS et chiffre d'affaires, en une requête.
    visibles.has('stats')
      ? toutesLesLignes((debut, fin) => admin
          .from('bookings')
          .select('booked_price, smart_discount, is_smart_slot')
          .eq('washer_id', washer.id)
          .eq('status', 'done')
          .gte('scheduled_at', `${mois.start}T00:00:00`)
          .lte('scheduled_at', `${mois.end}T23:59:59`)
          .order('scheduled_at')
          .order('id')
          .range(debut, fin))
      : Promise.resolve(null),
    // Widget Clients : seulement email + date de création, aucune jointure —
    // juste assez pour compter, pas pour réafficher une liste (voir la leçon
    // du 18/09 sur cette même page : ne pas rapatrier des lignes complètes
    // pour un simple chiffre).
    visibles.has('clients')
      ? toutesLesLignes((debut, fin) => admin
          .from('bookings')
          .select('client_email, created_at')
          .eq('washer_id', washer.id)
          .range(debut, fin))
      : aucuneLigne<{ client_email: string | null; created_at: string }>(),
    // Widget Trafic : événements de visite de la semaine en cours (lundi →
    // maintenant). `step` sert à compter les conversions.
    visibles.has('traffic')
      ? toutesLesLignes((debut, fin) => supabase
          .from('booking_funnel_events')
          .select('session_id, step')
          .eq('washer_id', washer.id)
          .gte('created_at', lundiCetteSemaine.toISOString())
          .range(debut, fin))
      : aucuneLigne<{ session_id: string; step: string }>(),
    // Widget Prestations : quelle prestation a été la plus demandée ce mois-ci.
    // Compte tout rendez-vous ayant existé (hors annulés) : c'est la demande
    // qu'on mesure, pas seulement ce qui a été facturé.
    visibles.has('services')
      ? toutesLesLignes((debut, fin) => admin
          .from('bookings')
          .select('services(name)')
          .eq('washer_id', washer.id)
          .neq('status', 'cancelled')
          .gte('scheduled_at', `${mois.start}T00:00:00`)
          .lte('scheduled_at', `${mois.end}T23:59:59`)
          .range(debut, fin))
      : aucuneLigne<{ services: { name: string } | { name: string }[] | null }>(),
    supabase.from('services').select('id', { count: 'exact', head: true }).eq('washer_id', washer.id),
    // Les jours de la semaine (`day_of_week`) plutôt qu'un simple comptage :
    // sert toujours à la carte de démarrage (`availabilitiesCount`), et sert
    // maintenant AUSSI à distinguer un jour FERMÉ d'un jour simplement vide
    // dans « Cette semaine » (voir plus bas) — sans une requête de plus,
    // seulement une colonne de plus dans celle qui existait déjà.
    supabase.from('availabilities').select('day_of_week').eq('washer_id', washer.id),
    // « Cette semaine » (accueil bureau, colonne de droite) : un point par
    // jour de la semaine en cours, lundi → dimanche. La seule requête ajoutée
    // par cette passe — bornée à sept jours, `id`/`scheduled_at`/`status`
    // seulement, aucun nom ni prix : ce n'est qu'un comptage par jour, pas
    // une liste à afficher (voir `semaineAccueil.ts`, qui porte le calcul).
    // Les annulés restent lus : la fonction pure les ignore elle-même, mais
    // les exclure ici ferait deux endroits qui portent la même règle.
    // Par `admin`, comme toutes les lectures de `bookings` (voir plus haut).
    admin
      .from('bookings')
      .select('id, scheduled_at, status')
      .eq('washer_id', washer.id)
      .gte('scheduled_at', bornesSemaine.debut.toISOString())
      .lt('scheduled_at', bornesSemaine.fin.toISOString())
      .order('scheduled_at'),
  ])

  // Même règle que dans les Paramètres : un comptage en échec ne doit pas
  // faire croire à un compte vide. On compte l'élément comme présent — la
  // carte de démarrage ne s'affiche pas plutôt que de réclamer à tort.
  if (erreurAVenir) logger.error('dashboard.bookings.fetch_failed', { washerId: washer.id }, erreurAVenir)
  if (historique.error) logger.error('dashboard.historique.fetch_failed', { washerId: washer.id }, historique.error)
  if (clientsLite.error) logger.warn('dashboard.clients_widget.fetch_failed', { washerId: washer.id }, clientsLite.error)
  if (visitesSemaine.error) logger.warn('dashboard.visiteurs_widget.fetch_failed', { washerId: washer.id }, visitesSemaine.error)
  if (prestationsMois.error) logger.warn('dashboard.prestations_widget.fetch_failed', { washerId: washer.id }, prestationsMois.error)
  if (services.error) logger.warn('dashboard.services_count_failed', { washerId: washer.id }, services.error)
  if (availabilities.error) logger.warn('dashboard.availabilities_count_failed', { washerId: washer.id }, availabilities.error)
  if (rdvSemaine.error) logger.warn('dashboard.semaine_widget.fetch_failed', { washerId: washer.id }, rdvSemaine.error)

  let terminesCeMois = 0
  let caCeMois = 0
  if (statsMois) {
    if (statsMois.error) logger.warn('dashboard.count_failed', { washerId: washer.id, statut: 'done_mois' }, statsMois.error)
    terminesCeMois = statsMois.data.length
    caCeMois = revenuNet(statsMois.data)
  }

  // Jours de la semaine couverts par au moins une plage d'horaires récurrente
  // (0 = dimanche … 6 = samedi, convention `availabilities.day_of_week` —
  // voir `lib/horaires.ts`) : sert à distinguer un jour FERMÉ d'un jour vide
  // dans « Cette semaine ». `null` sur une lecture en échec — on ne devine
  // aucune fermeture plutôt que d'en afficher une fausse.
  const joursOuverts = availabilities.error
    ? null
    : new Set((availabilities.data ?? []).map(a => Number(a.day_of_week)))

  const progress = computeSetupProgress({
    servicesCount: services.error ? 1 : (services.count ?? 0),
    availabilitiesCount: availabilities.error ? 1 : (availabilities.data?.length ?? 0),
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

  // ── Réservations au-delà du quota : visibles, mais muettes ──────────────
  //
  // Le masquage se fait ICI, au sortir de la base : un composant qui oublierait
  // la règle afficherait le vrai nom du client. À cet endroit, l'oubli est
  // impossible — la donnée n'existe déjà plus.
  //
  // Seules les listes de rendez-vous passent par le masque. Les comptages
  // (en attente, confirmés, chiffre d'affaires) restent entiers : le laveur a
  // le droit de savoir COMBIEN de demandes il a reçues, c'est même l'argument
  // qui lui donnera envie de changer d'offre. Ce qu'il n'a pas, c'est QUI.
  const seuilsVerrou = await seuilsVerrouillage(admin, washer, quotaReservations(washer))
  const aVenirVisible = masquerVerrouillees(aVenir ?? [], seuilsVerrou)
    .map(b => b.verrouillee
      // Midi UTC du jour de Paris : le jour quitte le serveur, jamais l'heure.
      ? { ...b, scheduled_at: `${new Date(b.scheduled_at).toLocaleDateString('en-CA', { timeZone: FUSEAU })}T12:00:00Z` }
      : b)
    // Re-trié après coup : laissée à sa place d'origine, la carte verrouillée trahirait son
    // heure par ses voisines (entre le rendez-vous de 10 h et celui de 11 h).
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
  // La jauge s'affiche en permanence, pas seulement une fois le mur atteint.
  // Le comptage n'a lieu que sur une offre plafonnée : ailleurs il n'y a rien
  // à compter, et ce serait une requête pour rien à chaque affichage.
  const plafondMensuel = quotaReservations(washer)
  const utiliseesCeMois = plafondMensuel === null ? null : await compterReservationsDeLaPeriode(admin, washer)
  // L'offre nommée sur les cartes floutées : la moins chère qui couvre le
  // volume du mois. Écrire « Pro » en dur ferait payer trente euros de plus à
  // un laveur que le Starter suffisait à débloquer.
  const offreDeblocage = PLAN_LABELS[offreQuiCouvre(planEffectif(washer), utiliseesCeMois)]

  const passes = historique.data ?? []

  // Les réservations verrouillées n'arrivent à l'écran que par `verrouillees` (jour seul) :
  // `masquerVerrouillees` a déjà retiré l'heure, le prix, le téléphone et l'adresse.
  const aVenirOuvertes = aVenirVisible.filter(b => !b.verrouillee)

  // `aujourdhui` est calculé plus haut, avant la requête réseau (voir son
  // commentaire) : ne montre ici que ce qui reste à faire — un rendez-vous
  // déjà clôturé n'a plus rien à demander.
  const rdvAujourdhui = aVenirOuvertes.filter(
    b => new Date(b.scheduled_at).toLocaleDateString('en-CA', { timeZone: FUSEAU }) === aujourdhui,
  )
  // Les trois prochains après aujourd'hui, dans l'ordre où `aVenir` est déjà trié.
  // Strictement APRÈS aujourd'hui, avant de prendre les trois premiers : sans borne, trois
  // anciens rendez-vous jamais clôturés occupaient les trois places, et un vrai rendez-vous
  // à venir n'apparaissait jamais (compte NovaFlows, 2026-10-09).
  const rdvProchains = aVenirOuvertes
    .filter(b => new Date(b.scheduled_at).toLocaleDateString('en-CA', { timeZone: FUSEAU }) > aujourdhui)
    .slice(0, 3)

  // « À confirmer » : les demandes en attente APRÈS aujourd'hui — celles du
  // jour sont déjà dans la journée, juste au-dessus, et les répéter en ferait
  // du bruit.
  const aConfirmer = aVenirOuvertes.filter(    b => b.status === 'pending'
      && new Date(b.scheduled_at).toLocaleDateString('en-CA', { timeZone: FUSEAU }) !== aujourdhui,
  )
  // Les demandes en attente qui dépassent le quota : elles s'affichent dans « À confirmer »
  // en carte floutée avec un cadenas. On ne transmet que l'id et LE JOUR (midi UTC du jour de
  // Paris) : ni l'heure ni le nom n'ont de raison de quitter le serveur.
  const verrouillees = aVenirVisible
    .filter(b => b.verrouillee && b.status === 'pending')
    .map(b => ({ id: b.id, scheduled_at: b.scheduled_at }))
  // « Journée commencée » : au moins un rendez-vous clôturé aujourd'hui, pour
  // distinguer « journée terminée » de « rien de prévu » quand il ne reste
  // rien à faire. Un booléen, pas un compte : `historique` est tronqué aux
  // cinq plus récents, un nombre affiché serait faux.
  const journeeCommencee = passes.some(
    b => b.status === 'done'
      && new Date(b.scheduled_at).toLocaleDateString('en-CA', { timeZone: FUSEAU }) === aujourdhui,
  )

  // « Cette semaine » (accueil bureau, colonne de droite) : un point par jour,
  // porté par la fonction pure `semaineAccueil` (testée) à partir de la
  // requête ajoutée plus haut — jamais recalculé ici à côté.
  const semaine = semaineAccueil(rdvSemaine.data ?? [], aujourdhui, joursOuverts)
  // « Demain » (même colonne, juste au-dessus) : un filtrage de ce qui est
  // déjà en main (`aVenirOuvertes` — complet, déjà démasqué des réservations
  // verrouillées), aucune requête de plus. Capé à rien : un jour calme ne
  // montre simplement pas la section (voir AccueilV2.tsx).
  const demainStr = ajouterJours(aujourdhui, 1)
  const rdvDemain = aVenirOuvertes.filter(b => jourParisDe(b.scheduled_at) === demainStr)

  const resumeClientsWidget = resumeClients(clientsLite.data ?? [], toDateStr(lundiCetteSemaine))

  // Widget Trafic : visiteurs de la semaine en cours, et sessions ayant
  // atteint « confirmation » (une réservation vraiment déposée) rapportées à
  // ces visiteurs — même calcul que la page CRM.
  const visiteursSemaine = countDistinctSessions(visitesSemaine.data ?? [])
  const conversionsSemaine = new Set(
    (visitesSemaine.data ?? []).filter(e => e.step === 'confirmation').map(e => e.session_id),
  ).size

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
  const prestationsComptees: { nom: string; nombre: number }[] = [...comptePrestations.entries()]
    .map(([nom, nombre]) => ({ nom, nombre }))
    .sort((a, b) => b.nombre - a.nombre)

  const widgetsAffiches = [...visibles]

  const demarrage = <DemarrageCard progress={progress} />

  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} subscriptionEndsAt={washer.subscription_ends_at ?? null} createdAt={washer.created_at} slug={washer.slug} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null} betaRefonte={washer.beta_refonte} visiteGuidee={visitesAFaire(washer)}>
      {/* Les valeurs des widgets restent à `null` quand le widget est masqué (donnée jamais lue). */}
      <AccueilV2
        demarrage={demarrage}
        rdvAujourdhui={rdvAujourdhui}
        rdvProchains={rdvProchains}
        aConfirmer={aConfirmer}
        journeeCommencee={journeeCommencee}
        dateDuJour={aujourdhui}
        widgets={widgetsAffiches}
        stats={statsMois ? { terminesCeMois, caCeMois: hasFeature(washer, 'ca_simple') ? caCeMois : null } : null}
        clients={visibles.has('clients') ? resumeClientsWidget : null}
        trafic={visibles.has('traffic') ? { visiteurs: visiteursSemaine, conversions: conversionsSemaine } : null}
        prestationTop={visibles.has('services') ? (prestationsComptees[0] ?? null) : null}
        zone={washer.zone_config}
        jauge={{
          utilisees: utiliseesCeMois ?? 0,
          quota: utiliseesCeMois === null ? null : plafondMensuel,
          offre: planEffectif(washer),
          remiseAZero: libelleRemiseAZero(washer.created_at),
        }}
        verrouillees={verrouillees}
        offreDeblocage={offreDeblocage}
        semaine={semaine}
        rdvDemain={rdvDemain}
        demainStr={demainStr}
        // `etapeDemarrage(progress) !== null` — exactement le signal que lit `DemarrageCard`
        // (étapes BLOQUANTES seulement : prestations, horaires, adresse). `!progress.essentialsDone`
        // aurait aussi compté le logo et le téléphone, non bloquants : un compte pleinement
        // opérationnel mais sans logo aurait vu la carte « premier jour » à la place de son
        // agenda dès un jour sans rendez-vous — faux signal, corrigé avant d'écrire l'écran.
        configurationIncomplete={etapeDemarrage(progress) !== null}
      />
    </DashboardShell>
  )
}

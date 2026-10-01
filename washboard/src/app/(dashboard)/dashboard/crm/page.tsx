import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import CrmView from '@/components/dashboard/CrmView'
import CampagnesView from '@/components/dashboard/CampagnesView'
import CrmOnglets, { type OngletCrm } from '@/components/dashboard/CrmOnglets'
import TrafficSourceLinks from '@/components/dashboard/TrafficSourceLinks'
import {
  SITE_URL_FALLBACK, hasFeature, requiredPlan, quotaReservations,
  PLAN_LABELS, PLAN_COULEURS,
} from '@/lib/plan'
import { seuilsVerrouillage, masquerVerrouillees } from '@/lib/reservationsVerrouillees'
import { normalizeHost } from '@/lib/funnelStats'
import { FUSEAU } from '@/lib/dateUtils'
import { logger } from '@/lib/logger'
import { toutesLesLignes } from '@/lib/supabase/toutesLesLignes'
import { washerDuUtilisateur } from '@/lib/washerCourant'
import { migrationEnAttente } from '@/lib/migrationEnAttente'
import { UpgradePrompt } from '@/components/dashboard/UpgradePrompt'
import { ApercuCrm, ApercuCampagnes } from '@/components/dashboard/ApercusVerrouilles'
import {
  bilansParCampagne, bilansParCreation, resteHorsCreations,
  type Campagne, type CampagneAffichee, type Creation, type Format, type Plateforme,
} from '@/lib/campagne'

// Fenêtre d'événements chargée. Elle borne ce qu'on peut analyser : au-delà,
// les statistiques de visite n'existent tout simplement pas. Un an couvre les
// périodes proposées par le sélecteur (jour, semaine, mois, année) sans faire
// transiter un volume déraisonnable vers le navigateur.
const FUNNEL_HISTORY_DAYS = 365

/** Ce que l'onglet Publicités a besoin de lire.
 *
 *  Isolé dans sa propre fonction, et appelé seulement quand l'onglet est
 *  ouvert : sans cette séparation, afficher les statistiques de visite ferait
 *  aussi charger toutes les campagnes, et l'inverse — deux fois le travail pour
 *  un écran qui n'en montre qu'un. */
async function chargerCampagnes(supabase: SupabaseClient, washerId: string) {
  let { data: campagnes, error: errCampagnes } = await supabase
    .from('campagnes')
    .select('id, nom, plateforme, budget, cle, debut, fin, budget_maj_le')
    .eq('washer_id', washerId)
    .order('debut', { ascending: false })

  // Colonne absente (migration 009) : on relit sans elle. L'écran perd le
  // « ce montant date de 47 jours », il ne perd pas les campagnes.
  if (errCampagnes && migrationEnAttente(errCampagnes)) {
    const sansDate = await supabase
      .from('campagnes')
      .select('id, nom, plateforme, budget, cle, debut, fin')
      .eq('washer_id', washerId)
      .order('debut', { ascending: false })
    if (!sansDate.error) {
      campagnes = (sansDate.data ?? []).map(c => ({ ...c, budget_maj_le: null }))
      errCampagnes = null
    }
  }

  // Table absente : la fonctionnalité n'est pas en service. On le remonte à
  // l'écran plutôt que d'afficher une liste vide — sinon le laveur remplit un
  // formulaire de campagne qui ne peut pas aboutir, et ne comprend l'échec
  // qu'après avoir tout saisi.
  if (errCampagnes && migrationEnAttente(errCampagnes)) {
    logger.warn('campagnes.migration_en_attente', { washerId })
    return { campagnes: [] as CampagneAffichee[], indisponible: true }
  }

  // Sans trace, une liste vide ne se distinguerait pas d'un laveur sans
  // campagne — et il croirait avoir perdu son travail.
  if (errCampagnes) logger.error('campagnes.list.read_failed', { washerId }, errCampagnes)

  const liste: Campagne[] = (campagnes ?? []).map(c => ({
    id: c.id as string,
    nom: c.nom as string,
    plateforme: c.plateforme as Plateforme,
    // `numeric` revient en chaîne depuis PostgREST : sans cette conversion, le
    // budget serait concaténé au lieu d'être divisé, et tous les retours
    // seraient faux.
    budget: Number(c.budget),
    cle: c.cle as string,
    debut: c.debut as string,
    fin: (c.fin as string | null) ?? null,
    budget_maj_le: (c.budget_maj_le as string | null | undefined) ?? null,
  }))

  if (liste.length === 0) return { campagnes: [] as CampagneAffichee[], indisponible: false }

  // Les créations, s'il y en a. Table absente = migration 008 non exécutée :
  // les campagnes s'affichent quand même, sans le détail par vidéo. Le code
  // peut ainsi partir avant la migration ou après, dans n'importe quel ordre.
  const { data: brutesCreations, error: errCreations } = await supabase
    .from('campagne_creations')
    .select('id, campagne_id, nom, format, cle, budget')
    .eq('washer_id', washerId)
    .order('created_at')

  if (errCreations) logger.warn('campagnes.creations.read_failed', { washerId }, errCreations)

  const creations: Creation[] = (brutesCreations ?? []).map(c => ({
    id: c.id as string,
    campagne_id: c.campagne_id as string,
    nom: c.nom as string,
    format: c.format as Format,
    cle: c.cle as string,
    budget: c.budget === null ? null : Number(c.budget),
  }))

  // On ne lit que ce qui porte une campagne, et jamais avant la plus ancienne
  // d'entre elles : inutile de parcourir un an de trafic organique pour
  // attribuer trois publicités.
  const depuis = liste.reduce((min, c) => (c.debut < min ? c.debut : min), liste[0].debut)

  // `utm_content` peut ne pas exister (migration 008) : on retente sans elle
  // plutôt que de perdre les bilans de campagne, qui eux fonctionnent déjà.
  const visites = await toutesLesLignes((d, f) => supabase
    .from('booking_funnel_events')
    .select('session_id, utm_campaign, utm_content, created_at')
    .eq('washer_id', washerId)
    .not('utm_campaign', 'is', null)
    .gte('created_at', `${depuis}T00:00:00Z`)
    .order('created_at').order('id').range(d, f))

  const visitesSures = visites.error
    ? await toutesLesLignes((d, f) => supabase
        .from('booking_funnel_events')
        .select('session_id, utm_campaign, created_at')
        .eq('washer_id', washerId)
        .not('utm_campaign', 'is', null)
        .gte('created_at', `${depuis}T00:00:00Z`)
        .order('created_at').order('id').range(d, f))
    : visites

  const reservations = await toutesLesLignes((d, f) => supabase
    .from('bookings')
    .select('utm_campaign, utm_content, created_at, status, booked_price')
    .eq('washer_id', washerId)
    .not('utm_campaign', 'is', null)
    .gte('created_at', `${depuis}T00:00:00Z`)
    .order('created_at').order('id').range(d, f))

  const reservationsSures = reservations.error
    ? await toutesLesLignes((d, f) => supabase
        .from('bookings')
        .select('utm_campaign, created_at, status, booked_price')
        .eq('washer_id', washerId)
        .not('utm_campaign', 'is', null)
        .gte('created_at', `${depuis}T00:00:00Z`)
        .order('created_at').order('id').range(d, f))
    : reservations

  if (visitesSures.error) logger.error('campagnes.visites.read_failed', { washerId }, visitesSures.error)
  if (reservationsSures.error) logger.error('campagnes.reservations.read_failed', { washerId }, reservationsSures.error)

  const lesVisites = visitesSures.data ?? []
  const lesReservations = reservationsSures.data ?? []
  const bilans = bilansParCampagne(liste, lesVisites, lesReservations)

  function assembler(c: Campagne): CampagneAffichee {
    // Un bilan à zéro plutôt qu'aucun : l'écran ne doit pas avoir à gérer le
    // cas d'une campagne qui n'a pas encore reçu une seule visite.
    const bilan = bilans.get(c.id) ?? {
      visites: 0, reservations: 0, tauxConversion: null,
      coutParReservation: null, chiffreAffaires: 0,
      retour: c.budget > 0 ? 0 : null,
    }
    const parCreation = bilansParCreation(c, creations, lesVisites, lesReservations)
    return { ...c, bilan, creations: parCreation, reste: resteHorsCreations(bilan, parCreation) }
  }

  return { campagnes: liste.map(assembler), indisponible: false }
}

export default async function CrmPage({ searchParams }: {
  searchParams: Promise<{ onglet?: string }>
}) {
  const { onglet } = await searchParams
  const ongletActif: OngletCrm = onglet === 'campagnes' ? 'campagnes' : 'apercu'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const washer = await washerDuUtilisateur(supabase, user.id, 'crm')

  const coque = (contenu: React.ReactNode) => (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} subscriptionEndsAt={washer.subscription_ends_at ?? null} createdAt={washer.created_at} slug={washer.slug} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null} betaRefonte={washer.beta_refonte}>
      {contenu}
    </DashboardShell>
  )

  // Le CRM fait partie de l'offre Starter (et au-dessus). Le verrou est posé
  // AVANT les lectures : inutile de parcourir une année d'événements pour
  // afficher un écran d'invitation à changer d'offre.
  if (!hasFeature(washer, 'crm')) {
    // Depuis QUAND les chiffres existent déjà. La collecte tourne pour tout le
    // monde, sans regarder l'offre (voir api/analytics/funnel) : ce qui est
    // fermé, c'est l'affichage, jamais l'enregistrement. Le laveur doit le
    // savoir, sinon il croit qu'attendre lui coûte son historique.
    //
    // La date est la PLUS RÉCENTE entre son inscription et la fenêtre d'un an
    // que le CRM sait lire : promettre « depuis votre inscription » à quelqu'un
    // inscrit il y a trois ans serait un mensonge le jour où il paie.
    const debutFenetre = new Date()
    debutFenetre.setDate(debutFenetre.getDate() - FUNNEL_HISTORY_DAYS)
    const inscription = washer.created_at ? new Date(washer.created_at) : null
    const depuis = inscription && !Number.isNaN(inscription.getTime()) && inscription > debutFenetre
      ? inscription
      : debutFenetre
    const depuisLabel = depuis.toLocaleDateString('fr-FR', {
      timeZone: FUSEAU, day: 'numeric', month: 'long', year: 'numeric',
    })

    return coque(
      <div className="p-4">
        <div className="mb-6">
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">CRM</h1>
        </div>
        <UpgradePrompt
          title="Sachez d’où viennent vos clients"
          description="Visiteurs, réservations, sources de trafic : comprenez ce qui remplit votre planning."
          feature="crm"
          apercu={<ApercuCrm />}
          rassurance={`Vos visites et vos réservations sont déjà enregistrées depuis le ${depuisLabel}. Vous ne perdez rien à attendre : tout s’affichera d’un coup le jour où vous changez d’offre.`}
        />
      </div>,
    )
  }

  // Le badge de l'onglet Publicités : le nom de l'offre qui l'ouvre, dit
  // d'avance. Sans lui, on clique et on tombe sur un mur sans avoir été
  // prévenu.
  const requisPubs = requiredPlan('campagnes')
  const badgePubs = hasFeature(washer, 'campagnes')
    ? undefined
    : { label: PLAN_LABELS[requisPubs], couleur: PLAN_COULEURS[requisPubs] }

  const onglets = <CrmOnglets actif={ongletActif} badge={badgePubs} />

  // ── Onglet Publicités ─────────────────────────────────────────────────────
  if (ongletActif === 'campagnes') {
    if (!hasFeature(washer, 'campagnes')) {
      return coque(
        <div>
          {onglets}
          <UpgradePrompt
            title="Savoir laquelle de vos vidéos vous rapporte"
            description="Déclarez votre budget, collez un lien par vidéo : WashBoard compte les visites, les réservations, et ce qu’elles ont rapporté — vidéo par vidéo."
            feature="campagnes"
            apercu={<ApercuCampagnes />}
            rassurance="Vos visites et vos réservations sont déjà enregistrées. Une campagne créée aujourd’hui commence à compter dès son premier clic."
          />
        </div>,
      )
    }

    const { campagnes, indisponible } = await chargerCampagnes(supabase, washer.id)
    return coque(
      <div>
        {onglets}
        <CampagnesView
          campagnes={campagnes}
          baseUrl={`${SITE_URL_FALLBACK}/book/${washer.slug}`}
          accent={washer.brand_color ?? undefined}
          indisponible={indisponible}
        />
      </div>,
    )
  }

  // ── Onglet Vue d'ensemble ─────────────────────────────────────────────────
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

  // Le CRM est la vue la plus complète qu'on ait sur un client : téléphone,
  // adresse, historique. Les réservations au-delà du quota n'y entrent pas —
  // sinon le laveur récupérait ici, en deux clics, exactement ce que l'accueil
  // et le calendrier viennent de lui cacher. Elles restent comptées sur la
  // page Clients, nom flouté et jour seul.
  const seuilsVerrou = await seuilsVerrouillage(supabase, washer, quotaReservations(washer))
  const bookingsVisibles = masquerVerrouillees(bookings ?? [], seuilsVerrou).filter(b => !b.verrouillee)

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

  return coque(
    <div>
      {onglets}

      {/* Les statistiques se calculent désormais dans le navigateur, à partir
          des événements bruts : changer de période ne recharge pas la page, et
          les visites comme les réservations portent sur la même sélection. */}
      <CrmView
        events={funnelEvents ?? []}
        bookings={bookingsVisibles}
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
    </div>,
  )
}

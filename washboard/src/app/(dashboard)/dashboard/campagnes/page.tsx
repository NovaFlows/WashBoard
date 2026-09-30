import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import CampagnesView from '@/components/dashboard/CampagnesView'
import { UpgradePrompt } from '@/components/dashboard/UpgradePrompt'
import { ApercuCampagnes } from '@/components/dashboard/ApercusVerrouilles'
import { SITE_URL_FALLBACK, hasFeature } from '@/lib/plan'
import { bilansParCampagne, type Campagne } from '@/lib/campagne'
import { washerDuUtilisateur } from '@/lib/washerCourant'
import { toutesLesLignes } from '@/lib/supabase/toutesLesLignes'
import { logger } from '@/lib/logger'

export default async function CampagnesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const washer = await washerDuUtilisateur(supabase, user.id, 'campagnes')

  // Le verrou est posé AVANT les lectures : inutile de parcourir les visites
  // et les réservations pour afficher un écran d'invitation à changer d'offre.
  if (!hasFeature(washer, 'campagnes')) {
    return (
      <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} createdAt={washer.created_at} slug={washer.slug} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null}>
        <div className="p-4">
          <div className="mb-6">
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Campagnes publicitaires</h1>
          </div>
          <UpgradePrompt
            title="Savoir si votre publicité vous rapporte"
            description="Déclarez votre budget, collez le lien dans votre publicité : WashBoard compte les visites, les réservations, et ce qu’elles ont rapporté."
            feature="campagnes"
            apercu={<ApercuCampagnes />}
            rassurance="Vos visites et vos réservations sont déjà enregistrées. Une campagne créée aujourd’hui commence à compter dès son premier clic."
          />
        </div>
      </DashboardShell>
    )
  }

  const { data: campagnes, error: errCampagnes } = await supabase
    .from('campagnes')
    .select('id, nom, plateforme, budget, cle, debut, fin')
    .eq('washer_id', washer.id)
    .order('debut', { ascending: false })

  // Sans trace, une liste vide ne se distinguerait pas d'un laveur sans
  // campagne — et il croirait avoir perdu son travail.
  if (errCampagnes) logger.error('campagnes.list.read_failed', { washerId: washer.id }, errCampagnes)

  const liste: Campagne[] = (campagnes ?? []).map(c => ({
    id: c.id as string,
    nom: c.nom as string,
    plateforme: c.plateforme as Campagne['plateforme'],
    // `numeric` revient en chaîne depuis PostgREST : sans cette conversion, le
    // budget serait concaténé au lieu d'être divisé, et tous les retours
    // seraient faux.
    budget: Number(c.budget),
    cle: c.cle as string,
    debut: c.debut as string,
    fin: (c.fin as string | null) ?? null,
  }))

  // Rien à compter s'il n'a pas encore de campagne : deux requêtes
  // d'agrégation pour afficher un écran vide seraient deux de trop.
  let bilans = new Map<string, ReturnType<typeof bilansParCampagne> extends Map<string, infer B> ? B : never>()
  if (liste.length > 0) {
    // On ne lit que ce qui porte une campagne, et jamais avant la plus
    // ancienne d'entre elles : inutile de parcourir un an de trafic organique
    // pour attribuer trois publicités.
    const depuis = liste.reduce((min, c) => (c.debut < min ? c.debut : min), liste[0].debut)

    const [visites, reservations] = await Promise.all([
      toutesLesLignes((d, f) => supabase
        .from('booking_funnel_events')
        .select('session_id, utm_campaign, created_at')
        .eq('washer_id', washer.id)
        .not('utm_campaign', 'is', null)
        .gte('created_at', `${depuis}T00:00:00Z`)
        .order('created_at')
        .order('id')
        .range(d, f)),
      toutesLesLignes((d, f) => supabase
        .from('bookings')
        .select('utm_campaign, created_at, status, booked_price')
        .eq('washer_id', washer.id)
        .not('utm_campaign', 'is', null)
        .gte('created_at', `${depuis}T00:00:00Z`)
        .order('created_at')
        .order('id')
        .range(d, f)),
    ])

    if (visites.error) logger.error('campagnes.visites.read_failed', { washerId: washer.id }, visites.error)
    if (reservations.error) logger.error('campagnes.reservations.read_failed', { washerId: washer.id }, reservations.error)

    bilans = bilansParCampagne(liste, visites.data ?? [], reservations.data ?? [])
  }

  const avecBilans = liste.map(c => ({
    ...c,
    // Un bilan à zéro plutôt qu'aucun : l'écran ne doit pas avoir à gérer le
    // cas d'une campagne qui n'a pas encore reçu une seule visite.
    bilan: bilans.get(c.id) ?? {
      visites: 0, reservations: 0, tauxConversion: null,
      coutParReservation: null, chiffreAffaires: 0,
      retour: c.budget > 0 ? 0 : null,
    },
  }))

  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} createdAt={washer.created_at} slug={washer.slug} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null}>
      <CampagnesView campagnes={avecBilans} baseUrl={`${SITE_URL_FALLBACK}/book/${washer.slug}`} />
    </DashboardShell>
  )
}

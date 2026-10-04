import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import Reglages from '@/components/dashboard/Reglages'
import { washerDuUtilisateur } from '@/lib/washerCourant'
import { computeSetupProgress } from '@/lib/setupProgress'
import { logger } from '@/lib/logger'

// Refonte 2026 — « Réglages » : ce qui règle l'application (apparence, notifications, barre de
// configuration, aide), par opposition à « Plus », qui règle l'entreprise du laveur.
// Réservée à la PWA installée (voir `Reglages.tsx`, le garde-fou).
//
// La « barre de configuration » (`SetupProgressBar`) vit maintenant ici plutôt que sur « Plus »
// (demande explicite d'Alexandre, 2026-10-04 : le bouton qui la masque/affiche vivait déjà sur
// cet écran, la carte elle-même devait le rejoindre). D'où les colonnes et comptages
// supplémentaires ci-dessous, repris tels quels de `dashboard/parametres/page.tsx` — même
// calcul, même garde-fou en cas d'échec de lecture (compter l'élément comme déjà fait plutôt
// que d'inventer un compte à 0 %).
const COLONNES =
  'id, name, trial_ends_at, subscription_status, plan, grandfathered, stripe_subscription_id, cancels_at, beta_refonte, created_at, slug, subscription_ends_at, ' +
  'base_address, phone, logo_url, google_refresh_token, review_enabled, followup_enabled, zone_config, smart_slot_enabled, welcome_message'

export default async function ReglagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const washer = await washerDuUtilisateur(supabase, user.id, 'reglages', COLONNES)

  const [services, availabilities] = await Promise.all([
    supabase.from('services').select('id', { count: 'exact', head: true }).eq('washer_id', washer.id),
    supabase.from('availabilities').select('day_of_week, start_time, end_time').eq('washer_id', washer.id),
  ])

  if (services.error) logger.warn('reglages.services_count_failed', { washerId: washer.id }, services.error)
  if (availabilities.error) logger.warn('reglages.availabilities_count_failed', { washerId: washer.id }, availabilities.error)

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

  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} createdAt={washer.created_at} slug={washer.slug} subscriptionEndsAt={washer.subscription_ends_at ?? null} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null} betaRefonte={washer.beta_refonte}>
      <Reglages progress={progress} />
    </DashboardShell>
  )
}

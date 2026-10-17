import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import Promotions from '@/components/dashboard/Promotions'
import { washerDuUtilisateur } from '@/lib/washerCourant'
import { logger } from '@/lib/logger'

// « Promotions » (2026-10-17) : une remise pendant une période, et le bandeau qui l'annonce
// sur la page de réservation (voir lib/promotion.ts). Sous `/dashboard/parametres/` pour que
// « Plus » reste allumé dans la barre du bas, comme « Mes liens ».
//
// Les promotions elles-mêmes sont chargées par l'écran (`GET /api/washer/promotions`) ; la
// page ne lit ici que la fiche et le nom des prestations, pour choisir lesquelles sont
// concernées.
const COLONNES =
  'id, name, slug, trial_ends_at, subscription_status, plan, grandfathered, stripe_subscription_id, cancels_at, beta_refonte, created_at, subscription_ends_at'

export default async function PromotionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const washer = await washerDuUtilisateur(supabase, user.id, 'promotions', COLONNES)

  const { data: services, error } = await supabase
    .from('services')
    .select('id, name')
    .eq('washer_id', washer.id)
    .order('created_at')
  if (error) logger.error('promotions.page.services_read_failed', { washerId: washer.id }, error)

  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} createdAt={washer.created_at} slug={washer.slug} subscriptionEndsAt={washer.subscription_ends_at ?? null} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null} betaRefonte={washer.beta_refonte}>
      <Promotions
        slug={washer.slug}
        services={(services ?? []).map(s => ({ id: s.id as string, name: s.name as string }))}
        liste={{ nom: washer.name, slug: washer.slug, plan: washer.plan, grandfathered: washer.grandfathered }}
        betaRefonte={washer.beta_refonte}
      />
    </DashboardShell>
  )
}

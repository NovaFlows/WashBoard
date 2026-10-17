import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import Fidelite from '@/components/dashboard/Fidelite'
import { washerDuUtilisateur } from '@/lib/washerCourant'
import { logoCarte } from '@/lib/fideliteServeur'

// « Carte de fidélité » (2026-10-17) : les tampons et la récompense (voir lib/fidelite.ts).
// Rangée dans Prestations et prix ; sous `/dashboard/parametres/` pour que « Plus » reste
// allumé dans la barre du bas. Les réglages sont chargés par l'écran
// (`GET /api/washer/fidelite`).
const COLONNES =
  'id, name, slug, trial_ends_at, subscription_status, plan, grandfathered, stripe_subscription_id, cancels_at, beta_refonte, created_at, subscription_ends_at, brand_color, logo_url, profile_updated_at'

export default async function FidelitePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const washer = await washerDuUtilisateur(supabase, user.id, 'fidelite', COLONNES)
  // Le logo sur la carte suit la même règle que sur la page de réservation (offre comprise).
  const logo = logoCarte(washer)

  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} createdAt={washer.created_at} slug={washer.slug} subscriptionEndsAt={washer.subscription_ends_at ?? null} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null} betaRefonte={washer.beta_refonte}>
      <Fidelite
        slug={washer.slug}
        liste={{ nom: washer.name, slug: washer.slug, plan: washer.plan, grandfathered: washer.grandfathered }}
        betaRefonte={washer.beta_refonte}
        marque={washer.brand_color ?? null}
        logo={logo}
        logoHorsOffre={!logo && !!washer.logo_url}
      />
    </DashboardShell>
  )
}

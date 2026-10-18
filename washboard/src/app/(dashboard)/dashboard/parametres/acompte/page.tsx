import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import Acompte from '@/components/dashboard/Acompte'
import { washerDuUtilisateur } from '@/lib/washerCourant'

// « Acompte » (2026-10-17) : l'acompte demandé à la réservation, payé par le lien du laveur
// (voir lib/acompte.ts). Rangé dans Prestations et prix ; sous `/dashboard/parametres/`
// pour que « Plus » reste allumé dans la barre du bas. Les réglages sont chargés par
// l'écran (`GET /api/washer/acompte`).
const COLONNES =
  'id, name, slug, trial_ends_at, subscription_status, plan, grandfathered, stripe_subscription_id, cancels_at, beta_refonte, created_at, subscription_ends_at'

export default async function AcomptePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const washer = await washerDuUtilisateur(supabase, user.id, 'acompte', COLONNES)

  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} createdAt={washer.created_at} slug={washer.slug} subscriptionEndsAt={washer.subscription_ends_at ?? null} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null} betaRefonte={washer.beta_refonte}>
      <Acompte
        slug={washer.slug}
        liste={{ nom: washer.name, slug: washer.slug, plan: washer.plan, grandfathered: washer.grandfathered }}
        betaRefonte={washer.beta_refonte}
      />
    </DashboardShell>
  )
}

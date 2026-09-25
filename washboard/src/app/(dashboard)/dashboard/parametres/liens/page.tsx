import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import MesLiens from '@/components/dashboard/MesLiens'
import { washerDuUtilisateur } from '@/lib/washerCourant'

// Refonte 2026 — « Mes liens » : le lien de réservation du laveur et un lien par
// réseau (Instagram, TikTok, Facebook, Google). Réservé à la PWA installée (voir
// MesLiens.tsx, le garde-fou : le site est renvoyé vers `/dashboard/crm`).
//
// L'adresse est sous `/dashboard/parametres/` pour que « Plus » reste allumé dans la
// barre du bas (BarreBasV2 : `startsWith('/dashboard/parametres')`).
//
// Aucune écriture, aucune lecture autre que la fiche : seul le lien public (`slug`)
// part vers le navigateur ; le reste sert au cadre (`DashboardShell`). Colonnes
// énumérées, jamais `*` : la fiche laveur porte des jetons Google et des identifiants
// Stripe.
const COLONNES =
  'id, name, slug, trial_ends_at, subscription_status, plan, grandfathered, stripe_subscription_id, cancels_at, beta_refonte'

export default async function MesLiensPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const washer = await washerDuUtilisateur(supabase, user.id, 'liens', COLONNES)

  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null} betaRefonte={washer.beta_refonte}>
      <MesLiens slug={washer.slug} />
    </DashboardShell>
  )
}

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import Reglages from '@/components/dashboard/Reglages'
import { washerDuUtilisateur } from '@/lib/washerCourant'

// Refonte 2026 — « Réglages » : ce qui règle l'application (apparence, notifications, barre de
// configuration, aide), par opposition à « Plus », qui règle l'entreprise du laveur.
// Réservée à la PWA installée (voir `Reglages.tsx`, le garde-fou).
//
// Aucune donnée n'est chargée ici : tout se lit dans le navigateur (thème, notifications,
// préférences d'affichage) ou vient du contexte des badges d'assistance, posé par
// DashboardShell. D'où la liste de colonnes minimale — jamais `*` : la fiche laveur porte des
// jetons Google et des identifiants Stripe.
//
// `brand_color` ajoutée (passe « Plus bureau, second lot », 2026-10-06) pour la liste « Plus »
// affichée à gauche sur grand écran (voir `ListeReglagesV2.tsx`) : une colonne de plus sur
// cette MÊME lecture, pas une requête en plus.
const COLONNES =
  'id, name, trial_ends_at, subscription_status, plan, grandfathered, stripe_subscription_id, cancels_at, beta_refonte, created_at, slug, subscription_ends_at, brand_color'

export default async function ReglagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const washer = await washerDuUtilisateur(supabase, user.id, 'reglages', COLONNES)

  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} createdAt={washer.created_at} slug={washer.slug} subscriptionEndsAt={washer.subscription_ends_at ?? null} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null} betaRefonte={washer.beta_refonte}>
      <Reglages
        liste={{
          nom: washer.name,
          slug: washer.slug,
          brandColor: washer.brand_color,
          plan: washer.plan,
          grandfathered: washer.grandfathered,
        }}
        betaRefonte={washer.beta_refonte}
      />
    </DashboardShell>
  )
}

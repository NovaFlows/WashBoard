import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import Depenses from '@/components/dashboard/Depenses'
import { washerDuUtilisateur } from '@/lib/washerCourant'

// Refonte 2026 — « Dépenses » : saisir, lire et supprimer ses frais (dont ceux qui reviennent
// chaque mois). Ouverte depuis Chiffres › Argent ; réservée à la PWA installée (voir
// Depenses.tsx, le garde-fou : le site est renvoyé vers `/dashboard/compta`).
//
// L'adresse est sous `/dashboard/chiffres/` pour que « Chiffres » reste allumé dans la barre du
// bas (BarreBasV2 : `startsWith('/dashboard/chiffres')`).
//
// Aucune donnée n'est chargée ici : l'écran lit `/api/expenses` depuis le navigateur, période
// par période (elle change sans recharger la page). Cette page ne sert qu'au cadre et à la
// vérification de session — d'où la liste de colonnes minimale (jamais `*` : la fiche laveur
// porte des jetons Google et des identifiants Stripe).
const COLONNES =
  'id, name, trial_ends_at, subscription_status, plan, grandfathered, stripe_subscription_id, cancels_at, beta_refonte'

export default async function DepensesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const washer = await washerDuUtilisateur(supabase, user.id, 'depenses', COLONNES)

  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null} betaRefonte={washer.beta_refonte}>
      <Depenses />
    </DashboardShell>
  )
}

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import Apparence from '@/components/dashboard/Apparence'
import { washerDuUtilisateur } from '@/lib/washerCourant'

// Refonte 2026 — « Apparence de ma page » : le logo, la couleur, le fond, le message
// d'accueil et le site web de la page de réservation. Réservé à la PWA installée
// (voir Apparence.tsx, le garde-fou : le site est renvoyé vers
// `/dashboard/admin#identite`).
//
// L'adresse est sous `/dashboard/parametres/` pour que « Plus » reste allumé dans la
// barre du bas (BarreBasV2 : `startsWith('/dashboard/parametres')`) — c'est un écran
// de « Plus », comme `parametres/horaires`.
//
// Lecture seule ici : les écritures passent par `/api/washer` et ses deux routes
// d'envoi d'image (`/logo`, `/background`) depuis le navigateur.
//
// Les colonnes sont ÉNUMÉRÉES (jamais `*`) : tout ce qui franchit la frontière
// serveur → navigateur est sérialisé dans la page, et la fiche laveur porte des
// jetons Google et des identifiants Stripe. Seuls partent vers le navigateur les
// cinq réglages, le nom et le lien de la page ; le reste sert au cadre
// (`DashboardShell`), comme sur les autres écrans.
//
// Une lecture qui échoue ne rend jamais un écran « sans logo, sans message » : la
// lecture de la fiche lève (voir `washerDuUtilisateur`) et l'écran d'erreur du
// tableau de bord propose « Réessayer ». Un compte vide et une panne ne se
// confondent donc pas.
const COLONNES =
  'id, name, slug, logo_url, brand_color, background_theme, welcome_message, website_url, ' +
  'trial_ends_at, subscription_status, plan, grandfathered, stripe_subscription_id, cancels_at, beta_refonte'

export default async function ApparencePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const washer = await washerDuUtilisateur(supabase, user.id, 'apparence', COLONNES)

  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null} betaRefonte={washer.beta_refonte}>
      <Apparence
        nom={washer.name}
        slug={washer.slug}
        initial={{
          logoUrl: washer.logo_url ?? null,
          couleur: washer.brand_color ?? null,
          fond: washer.background_theme ?? null,
          message: washer.welcome_message ?? null,
          site: washer.website_url ?? null,
        }}
      />
    </DashboardShell>
  )
}

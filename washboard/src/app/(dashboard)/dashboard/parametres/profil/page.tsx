import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import Profil from '@/components/dashboard/Profil'
import { washerDuUtilisateur } from '@/lib/washerCourant'
import { hasFeature } from '@/lib/plan'
import type { Washer } from '@/types'

// Refonte 2026 — « Mon profil » : l'entreprise (nom, téléphone, adresse de départ, nombre de
// laveurs), les mentions portées sur les factures, et les identifiants de connexion. Réservé à
// la PWA installée (voir Profil.tsx, le garde-fou : le site est renvoyé vers
// `/dashboard/parametres/tout#profil`).
//
// L'adresse est sous `/dashboard/parametres/` pour que « Plus » reste allumé dans la barre du
// bas (BarreBasV2 : `startsWith('/dashboard/parametres')`).
//
// Lecture seule ici : les écritures passent par `PATCH /api/washer` (profil, facturation) et
// par Supabase Auth depuis le navigateur (e-mail, mot de passe). Les colonnes sont ÉNUMÉRÉES
// (jamais `*`) : tout ce qui franchit la frontière serveur → navigateur est sérialisé dans la
// page, et la fiche laveur porte des jetons Google et des identifiants Stripe.
const COLONNES =
  'id, name, phone, base_address, team_size, ' +
  'facture_statut, facture_nom_legal, facture_siret, facture_adresse, facture_forme_juridique, ' +
  'facture_capital, facture_immatriculation, facture_regime_tva, facture_taux_tva, facture_numero_tva, ' +
  'facture_prochain_numero, ' +
  'trial_ends_at, subscription_status, plan, grandfathered, stripe_subscription_id, cancels_at, beta_refonte'

export default async function ProfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const washer = await washerDuUtilisateur(supabase, user.id, 'profil', COLONNES)

  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null} betaRefonte={washer.beta_refonte}>
      <Profil
        washer={washer as Washer}
        email={user.email ?? ''}
        // Décidé côté serveur : le plan ne doit pas se deviner dans le navigateur.
        peutEquipe={hasFeature(washer, 'multi_laveurs')}
      />
    </DashboardShell>
  )
}

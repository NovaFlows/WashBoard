import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import Documents from '@/components/dashboard/Documents'
import { washerDuUtilisateur } from '@/lib/washerCourant'
import { logger } from '@/lib/logger'

// Refonte 2026 — « Devis et factures » : écrire un devis ou une facture sans rendez-vous
// derrière. Ouverte depuis Chiffres › Argent ; réservée à la PWA installée (voir
// `Documents.tsx`, le garde-fou : le site est renvoyé vers `/dashboard/factures`).
//
// L'adresse est sous `/dashboard/chiffres/` pour que « Chiffres » reste allumé dans la barre
// du bas (BarreBasV2 : `startsWith('/dashboard/chiffres')`).
//
// Les documents eux-mêmes sont lus par le navigateur (`/api/documents`) : seules les
// prestations du laveur sont chargées ici, pour remplir une ligne d'un tap plutôt que de la
// taper. D'où la liste de colonnes minimale (jamais `*` : la fiche laveur porte des jetons
// Google et des identifiants Stripe).
const COLONNES =
  'id, name, trial_ends_at, subscription_status, plan, grandfathered, stripe_subscription_id, cancels_at, beta_refonte'

export default async function DocumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const washer = await washerDuUtilisateur(supabase, user.id, 'documents', COLONNES)

  const { data: prestations, error } = await supabase
    .from('services')
    .select('id, name, price')
    .eq('washer_id', washer.id)
    .order('name')
  // Sans elles, l'écran marche : on tape la désignation à la main.
  if (error) logger.warn('documents.services.read_failed', { washerId: washer.id }, error)

  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null} betaRefonte={washer.beta_refonte}>
      <Documents prestations={(prestations ?? []).map(p => ({ id: p.id, name: p.name, price: Number(p.price) }))} />
    </DashboardShell>
  )
}

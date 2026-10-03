import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import BilanPublicites from '@/components/dashboard/BilanPublicites'
import { hasFeature } from '@/lib/plan'
import { washerDuUtilisateur } from '@/lib/washerCourant'
import { chargerCampagnes } from '@/lib/campagnesServeur'

// « Bilan » — la vue qui additionne toutes les campagnes.
//
// Sous `/dashboard/clients/` comme l'écran dont elle vient, pour que
// « Clients » reste allumé dans la barre du bas. Elle n'a pas d'entrée de menu
// propre : on y arrive par le lien en bas de l'écran Publicités, et c'est
// voulu — c'est une lecture de second temps, pas une destination.
//
// Sans campagne, il n'y a rien à additionner : on renvoie à l'écran
// précédent plutôt que d'afficher une page de zéros.
export default async function BilanPublicitesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const washer = await washerDuUtilisateur(supabase, user.id, 'publicites-bilan')
  if (!hasFeature(washer, 'campagnes')) redirect('/dashboard/clients/publicites')

  const { campagnes, indisponible } = await chargerCampagnes(supabase, washer.id)
  if (indisponible || campagnes.length === 0) redirect('/dashboard/clients/publicites')

  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} subscriptionEndsAt={washer.subscription_ends_at ?? null} createdAt={washer.created_at} slug={washer.slug} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null} betaRefonte={washer.beta_refonte}>
      <BilanPublicites campagnes={campagnes} />
    </DashboardShell>
  )
}

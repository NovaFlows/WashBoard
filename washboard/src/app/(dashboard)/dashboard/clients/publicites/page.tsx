import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import Publicites from '@/components/dashboard/Publicites'
import { UpgradePrompt } from '@/components/dashboard/UpgradePrompt'
import { ApercuCampagnes } from '@/components/dashboard/ApercusVerrouilles'
import { SITE_URL_FALLBACK, hasFeature } from '@/lib/plan'
import { washerDuUtilisateur } from '@/lib/washerCourant'
import { chargerCampagnes } from '@/lib/campagnesServeur'

// Refonte 2026 — « Publicités » dans l'application installée.
//
// L'adresse est sous `/dashboard/clients/` pour que « Clients » reste allumé
// dans la barre du bas (BarreBasV2 : `startsWith('/dashboard/clients')`), comme
// « Messages automatiques ». L'écran se range dans la section « Automatismes »
// de Clients, avec les avis et les relances : ce sont les trois choses qui
// travaillent pendant que le laveur lave.
//
// La lecture est celle du CRM, partagée (`lib/campagnesServeur`) et non
// recopiée : les deux écrans doivent donner le même chiffre pour la même
// campagne, aujourd'hui et après la prochaine correction d'une règle de
// comptage.
export default async function PublicitesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const washer = await washerDuUtilisateur(supabase, user.id, 'publicites')

  const coque = (contenu: React.ReactNode) => (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} subscriptionEndsAt={washer.subscription_ends_at ?? null} createdAt={washer.created_at} slug={washer.slug} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null} betaRefonte={washer.beta_refonte}>
      {contenu}
    </DashboardShell>
  )

  // Le verrou est posé AVANT la lecture : inutile de parcourir les visites et
  // les réservations pour afficher un écran d'invitation à changer d'offre.
  if (!hasFeature(washer, 'campagnes')) {
    return coque(
      <div className="p-4">
        <UpgradePrompt
          title="Savoir laquelle de vos vidéos vous rapporte"
          description="Déclarez votre budget, collez un lien par vidéo : WashBoard compte les visites, les réservations, et ce qu’elles ont rapporté — vidéo par vidéo."
          feature="campagnes"
          apercu={<ApercuCampagnes />}
          rassurance="Vos visites et vos réservations sont déjà enregistrées. Une campagne créée aujourd’hui commence à compter dès son premier clic."
        />
      </div>,
    )
  }

  const { campagnes, indisponible } = await chargerCampagnes(supabase, washer.id)

  return coque(
    <Publicites
      campagnes={campagnes}
      baseUrl={`${SITE_URL_FALLBACK}/book/${washer.slug}`}
      indisponible={indisponible}
    />,
  )
}

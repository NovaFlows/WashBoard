import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import Assistance from '@/components/dashboard/Assistance'

// Un lien direct `?fil=<id>` (notification, email) doit toujours retomber
// sur les vraies données du laveur qui clique, jamais sur un instantané mis
// en cache — même raison que /dashboard/support (page équipe).
export const dynamic = 'force-dynamic'

export default async function AssistancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // '*' plutôt qu'une liste de colonnes explicite (refonte 2026, passe 4) :
  // `washer.beta_refonte` doit rester lisible ici pour que la barre du bas
  // s'affiche sur cette page aussi. Un `select` qui nomme les colonnes une à
  // une casserait dès qu'on en ajoute une qui n'existe pas encore en base
  // (jamais le cas de '*', qui tolère une colonne absente).
  const { data: washer } = await supabase.from('washers').select('*').eq('user_id', user.id).single()
  if (!washer) redirect('/login')

  return (
    <DashboardShell
      washerName={washer.name}
      trialEndsAt={washer.trial_ends_at}
      subscriptionStatus={washer.subscription_status}
      plan={washer.plan}
      grandfathered={washer.grandfathered}
      stripeSubscriptionId={washer.stripe_subscription_id ?? null}
      cancelsAt={washer.cancels_at ?? null}
      betaRefonte={washer.beta_refonte}
    >
      <Assistance beta={!!washer.beta_refonte} />
    </DashboardShell>
  )
}

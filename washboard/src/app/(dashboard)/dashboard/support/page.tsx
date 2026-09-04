import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSupportMember } from '@/lib/supportAccess'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import SupportAccessForm from '@/components/dashboard/SupportAccessForm'

export const dynamic = 'force-dynamic'

// Page réservée à l'équipe support : ouvrir une session sur le compte d'un
// laveur qui a demandé de l'aide.
//
// Elle n'apparaît dans aucun menu et renvoie vers le tableau de bord pour
// quiconque n'est pas dans SUPPORT_ADMIN_EMAILS — un laveur qui devinerait
// l'adresse ne doit pas même savoir que cette page existe.
export default async function SupportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!isSupportMember(user.email, process.env.SUPPORT_ADMIN_EMAILS)) {
    redirect('/dashboard')
  }

  const { data: washer } = await supabase
    .from('washers').select('*').eq('user_id', user.id).single()
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
    >
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Support</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Accéder au compte d&apos;un laveur qui a ouvert l&apos;accès depuis ses réglages.
        </p>
      </div>
      <SupportAccessForm />
    </DashboardShell>
  )
}

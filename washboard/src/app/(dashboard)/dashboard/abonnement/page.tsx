import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import AbonnementPanel from '@/components/dashboard/AbonnementPanel'

export default async function AbonnementPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

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
    >
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Abonnement</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Gérez votre abonnement WashBoard</p>
      </div>
      <AbonnementPanel
        subscriptionStatus={washer.subscription_status ?? 'trial'}
        trialEndsAt={washer.trial_ends_at ?? null}
        washerName={washer.name}
        washerEmail={user.email ?? ''}
        plan={washer.plan ?? 'essentiel'}
        grandfathered={washer.grandfathered ?? false}
      />
    </DashboardShell>
  )
}

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import GuideContent from '@/components/dashboard/GuideContent'

export default async function GuidePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: washer } = await supabase.from('washers').select('name, trial_ends_at, subscription_status, plan, grandfathered, stripe_subscription_id, cancels_at').eq('user_id', user.id).single()
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
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-1">Guide de démarrage</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Cherchez une réponse, ou parcourez les sections. Les mots en bleu vous emmènent directement au bon endroit.
          </p>
        </div>

        <GuideContent
          intro={
            <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-lg mb-10">
              <video
                src="/tuto.mp4"
                controls
                playsInline
                className="w-full block"
                style={{ aspectRatio: '16/9', background: '#09111E' }}
              />
            </div>
          }
        />
      </div>
    </DashboardShell>
  )
}

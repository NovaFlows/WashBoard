import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import GuideV2 from '@/components/dashboard/GuideV2'
import { washerDuUtilisateur } from '@/lib/washerCourant'

export default async function GuidePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const washer = await washerDuUtilisateur(supabase, user.id, 'guide')

  return (
    <DashboardShell
      washerName={washer.name}
      trialEndsAt={washer.trial_ends_at}
      subscriptionStatus={washer.subscription_status}
      plan={washer.plan}
      grandfathered={washer.grandfathered} subscriptionEndsAt={washer.subscription_ends_at ?? null} createdAt={washer.created_at} slug={washer.slug}
      stripeSubscriptionId={washer.stripe_subscription_id ?? null}
      cancelsAt={washer.cancels_at ?? null}
    >
      <GuideV2
        liste={{
          nom: washer.name,
          slug: washer.slug,
          brandColor: washer.brand_color,
          plan: washer.plan,
          grandfathered: washer.grandfathered,
        }}
      />
    </DashboardShell>
  )
}

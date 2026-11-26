import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import ParrainageV2 from '@/components/dashboard/ParrainageV2'
import { washerDuUtilisateur } from '@/lib/washerCourant'
import { infosFacturationManquantes } from '@/lib/facture'

export default async function ParrainagePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const washer = await washerDuUtilisateur(supabase, user.id, 'parrainage')

  return (
    <DashboardShell
      washerName={washer.name}
      trialEndsAt={washer.trial_ends_at}
      subscriptionStatus={washer.subscription_status}
      plan={washer.plan}
      grandfathered={washer.grandfathered} subscriptionEndsAt={washer.subscription_ends_at ?? null} createdAt={washer.created_at} slug={washer.slug}
      abonnementStripe={!!washer.stripe_subscription_id}
      cancelsAt={washer.cancels_at ?? null}
    >
      <ParrainageV2
        liste={{
          nom: washer.name,
          slug: washer.slug,
          brandColor: washer.brand_color,
          plan: washer.plan,
          grandfathered: washer.grandfathered,
          facturationIncomplete: infosFacturationManquantes(washer).length > 0,
        }}
      />
    </DashboardShell>
  )
}

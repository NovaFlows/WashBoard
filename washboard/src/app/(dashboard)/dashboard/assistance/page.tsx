import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { Suspense } from 'react'
import AssistanceV2 from '@/components/dashboard/AssistanceV2'

// Un lien direct `?fil=<id>` (notification, email) doit toujours retomber
// sur les vraies données du laveur qui clique, jamais sur un instantané mis
// en cache — même raison que /dashboard/support (page équipe).
export const dynamic = 'force-dynamic'

export default async function AssistancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // '*' plutôt qu'une liste de colonnes : un `select` qui nomme les colonnes une à une
  // casserait dès qu'on en ajoute une qui n'existe pas encore en base — et '*' couvre
  // toutes celles que le châssis lit (created_at, slug…) pour le badge de
  // plan et les bandeaux d'offres.
  const { data: washer } = await supabase.from('washers').select('*').eq('user_id', user.id).single()
  if (!washer) redirect('/login')

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
      {/* useSearchParams (lecture de ?fil=) exige une limite Suspense. */}
      <Suspense fallback={null}>
        <AssistanceV2
          liste={{
            nom: washer.name,
            slug: washer.slug,
            brandColor: washer.brand_color,
            plan: washer.plan,
            grandfathered: washer.grandfathered,
          }}
        />
      </Suspense>
    </DashboardShell>
  )
}

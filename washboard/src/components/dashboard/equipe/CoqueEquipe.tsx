import { DashboardShell } from '@/components/dashboard/DashboardShell'
import type { Plan } from '@/lib/plan'

type FicheEquipe = {
  name?: string | null
  trial_ends_at?: string | null
  subscription_status?: string | null
  plan?: string | null
  grandfathered?: boolean | null
  stripe_subscription_id?: string | null
  cancels_at?: string | null
} | null

/** Coque du tableau de bord pour l'espace équipe, sans supposer de fiche
 *  laveur (même raisonnement que la page Support). */
export default function CoqueEquipe({ washer, children }: { washer: FicheEquipe; children: React.ReactNode }) {
  return (
    <DashboardShell
      washerName={washer?.name ?? undefined}
      trialEndsAt={washer?.trial_ends_at ?? null}
      subscriptionStatus={washer?.subscription_status ?? null}
      plan={(washer?.plan ?? undefined) as Plan | undefined}
      grandfathered={washer?.grandfathered ?? false}
      stripeSubscriptionId={washer?.stripe_subscription_id ?? null}
      cancelsAt={washer?.cancels_at ?? null}
    >
      {children}
    </DashboardShell>
  )
}

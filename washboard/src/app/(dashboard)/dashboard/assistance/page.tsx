import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import AssistanceContent from '@/components/dashboard/AssistanceContent'
import SupportAccessForm from '@/components/dashboard/SupportAccessForm'
import { isSupportMember } from '@/lib/supportAccess'

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

  // Décidé ici, côté serveur : le formulaire n'est même pas envoyé à un laveur. La route
  // `/api/support/access` refait de toute façon le contrôle (et celui de l'accord du laveur).
  const estEquipe = isSupportMember(user.email, process.env.SUPPORT_ADMIN_EMAILS)

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
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-1">Assistance</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Vos questions à l&apos;équipe, et les réponses reçues. Pour chercher une réponse par
            vous-même, direction le{' '}
            <Link href="/dashboard/guide" className="font-semibold text-[#1651E8] dark:text-[#6A9FFF] hover:underline">
              Guide
            </Link>.
          </p>
        </div>

        {estEquipe && (
          <section aria-label="Équipe : prendre la main sur un compte" className="mb-8">
            <h2 className="text-lg font-black text-slate-900 dark:text-white mb-1">Prendre la main sur un compte</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
              Réservé à l&apos;équipe : le laveur doit avoir ouvert l&apos;accès depuis ses réglages.
            </p>
            <SupportAccessForm />
          </section>
        )}

        {/* useSearchParams (lecture de ?fil=) exige une limite Suspense :
            sans elle, Next refuse de construire cette route. */}
        <Suspense fallback={null}>
          <AssistanceContent />
        </Suspense>
      </div>
    </DashboardShell>
  )
}

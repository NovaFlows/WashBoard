import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import GuideContent from '@/components/dashboard/GuideContent'
import { washerDuUtilisateur } from '@/lib/washerCourant'

export default async function GuidePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Colonnes par défaut ('*', voir washerCourant.ts) plutôt que la liste
  // explicite d'avant (refonte 2026, passe 4) : `washer.beta_refonte` doit
  // rester lisible ici pour que la barre du bas s'affiche sur cette page
  // aussi, et une liste de colonnes nommées une à une casserait dès qu'on y
  // ajoute une colonne qui n'existe pas encore en base.
  const washer = await washerDuUtilisateur(supabase, user.id, 'guide')

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

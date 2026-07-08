import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'

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
            Revois le tutoriel complet à tout moment pour maîtriser chaque fonctionnalité.
          </p>
        </div>

        <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-lg mb-10">
          <video
            src="/tuto.mp4"
            controls
            playsInline
            className="w-full block"
            style={{ aspectRatio: '16/9', background: '#09111E' }}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { num: '01', title: 'Configurer ta page', desc: 'Logo, couleur, services, tarifs — personnalise ta page de réservation dans Paramètres.' },
            { num: '02', title: 'Partager ton lien', desc: 'Envoie ton lien personnalisé à tes clients. Ils réservent directement, sans compte.' },
            { num: '03', title: 'Gérer ton agenda', desc: 'Consulte et confirme tes RDV dans l\'onglet Calendrier. Les créneaux intelligents regroupent tes tournées.' },
            { num: '04', title: 'Suivre tes clients', desc: 'Le CRM liste tous tes clients avec leur historique, leur CA et leurs notes.' },
          ].map(({ num, title, desc }) => (
            <div key={num} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <p className="text-3xl font-black text-[#1651E8]/20 dark:text-[#6A9FFF]/20 mb-2">{num}</p>
              <p className="font-bold text-slate-900 dark:text-white mb-1">{title}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </DashboardShell>
  )
}

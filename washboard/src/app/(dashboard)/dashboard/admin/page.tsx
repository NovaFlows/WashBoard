import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import AdminTabs from '@/components/dashboard/admin/AdminTabs'
import Link from 'next/link'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: washer } = await supabase.from('washers').select('*').eq('user_id', user.id).single()
  if (!washer) redirect('/login')

  const [
    { data: services },
    { data: categories },
    { data: availabilities },
    { data: unavailabilities },
  ] = await Promise.all([
    supabase.from('services').select('*').eq('washer_id', washer.id).order('created_at'),
    supabase.from('service_categories').select('*').eq('washer_id', washer.id).order('display_order'),
    supabase.from('availabilities').select('*').eq('washer_id', washer.id).order('day_of_week'),
    supabase.from('unavailabilities').select('*').eq('washer_id', washer.id).order('start_date'),
  ])

  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered}>
      <div className="mb-6">
        <Link
          href="/dashboard/parametres"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-3 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Paramètres
        </Link>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Page client</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Configurez ce que vos clients voient sur votre page de réservation
        </p>
      </div>
      <AdminTabs washer={washer} services={services ?? []} categories={categories ?? []} availabilities={availabilities ?? []} unavailabilities={unavailabilities ?? []} />
    </DashboardShell>
  )
}

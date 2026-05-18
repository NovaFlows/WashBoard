import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import AdminTabs from '@/components/dashboard/admin/AdminTabs'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: washer } = await supabase.from('washers').select('*').eq('user_id', user.id).single()
  if (!washer) redirect('/login')

  const { data: services } = await supabase.from('services').select('*').eq('washer_id', washer.id).order('created_at')
  const { data: availabilities } = await supabase.from('availabilities').select('*').eq('washer_id', washer.id).order('day_of_week')

  return (
    <DashboardShell washerName={washer.name}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Page client</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Configurez ce que vos clients voient sur votre page de réservation
        </p>
      </div>
      <AdminTabs washer={washer} services={services ?? []} availabilities={availabilities ?? []} />
    </DashboardShell>
  )
}

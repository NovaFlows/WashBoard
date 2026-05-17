import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'

export default async function CRMPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: washer } = await supabase
    .from('washers')
    .select('name')
    .eq('user_id', user.id)
    .single()

  if (!washer) redirect('/login')

  return (
    <DashboardShell washerName={washer.name}>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">CRM</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs">
          Gérez vos clients, leur historique et leurs préférences. Disponible prochainement.
        </p>
        <span className="mt-4 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400">
          En construction — V3
        </span>
      </div>
    </DashboardShell>
  )
}

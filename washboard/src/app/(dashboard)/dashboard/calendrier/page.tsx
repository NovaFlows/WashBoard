import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'

export default async function CalendrierPage() {
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
        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Calendrier</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs">
          Visualisez vos créneaux et réservations sur un calendrier mensuel. Disponible prochainement.
        </p>
        <span className="mt-4 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400">
          En construction — V4
        </span>
      </div>
    </DashboardShell>
  )
}

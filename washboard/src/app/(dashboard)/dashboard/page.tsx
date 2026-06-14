import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BookingList from '@/components/dashboard/BookingList'
import { DashboardShell } from '@/components/dashboard/DashboardShell'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: washer } = await supabase
    .from('washers')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!washer) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <p className="text-slate-500 dark:text-slate-400">Profil laveur non trouvé. Contactez le support.</p>
      </div>
    )
  }

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, services(name, price, duration_minutes)')
    .eq('washer_id', washer.id)
    .order('scheduled_at', { ascending: true })

  const all = bookings ?? []
  const pending = all.filter(b => b.status === 'pending').length
  const confirmed = all.filter(b => b.status === 'confirmed').length
  const done = all.filter(b => b.status === 'done').length

  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status}>
      <div className="grid grid-cols-3 gap-3 mb-8">
        <StatCard label="En attente" value={pending} color="amber" />
        <StatCard label="Confirmés" value={confirmed} color="emerald" />
        <StatCard label="Terminés" value={done} color="slate" />
      </div>

      <BookingList bookings={all} washerId={washer.id} />
    </DashboardShell>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: 'amber' | 'emerald' | 'slate' }) {
  const colors = {
    amber:   'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400',
    slate:   'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400',
  }
  return (
    <div className={`rounded-xl border p-3 text-center ${colors[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium mt-0.5 opacity-80">{label}</p>
    </div>
  )
}

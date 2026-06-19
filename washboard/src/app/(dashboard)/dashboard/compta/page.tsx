import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import ComptaDashboard from '@/components/dashboard/ComptaDashboard'

export default async function ComptaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: washer } = await supabase.from('washers').select('*').eq('user_id', user.id).single()
  if (!washer) redirect('/login')

  // Revenus du mois courant pour le SSR initial
  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1
  const start = `${year}-${String(month).padStart(2, '0')}-01T00:00:00`
  const end   = new Date(year, month, 1).toISOString().slice(0, 10) + 'T00:00:00'

  const { data: bookings } = await supabase
    .from('bookings')
    .select('booked_price, smart_discount, is_smart_slot')
    .eq('washer_id', washer.id)
    .eq('status', 'done')
    .gte('scheduled_at', start)
    .lt('scheduled_at', end)

  const initialRevenue = (bookings ?? []).reduce((sum, b) => {
    const price    = Number(b.booked_price ?? 0)
    const discount = b.is_smart_slot ? Number(b.smart_discount ?? 0) : 0
    return sum + price - discount
  }, 0)

  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status}>
      <div className="p-4 max-w-2xl mx-auto">
        <div className="mb-5">
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Comptabilité</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">CA et dépenses par mois</p>
        </div>
        <ComptaDashboard initialRevenue={initialRevenue} washerId={washer.id} />
      </div>
    </DashboardShell>
  )
}

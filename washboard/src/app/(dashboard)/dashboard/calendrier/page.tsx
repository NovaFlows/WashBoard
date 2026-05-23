import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import CalendrierDashboard from '@/components/dashboard/CalendrierDashboard'

export default async function CalendrierPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: washer } = await supabase
    .from('washers').select('*').eq('user_id', user.id).single()
  if (!washer) redirect('/login')

  const [
    { data: bookings },
    { data: unavailabilities },
    { data: services },
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select('*, services(name, price, duration_minutes)')
      .eq('washer_id', washer.id)
      .order('scheduled_at', { ascending: true }),
    supabase
      .from('unavailabilities')
      .select('*')
      .eq('washer_id', washer.id)
      .order('start_date'),
    supabase
      .from('services')
      .select('*')
      .eq('washer_id', washer.id)
      .order('created_at'),
  ])

  return (
    <DashboardShell washerName={washer.name}>
      <CalendrierDashboard
        bookings={bookings ?? []}
        unavailabilities={unavailabilities ?? []}
        teamSize={washer.team_size ?? 1}
        services={services ?? []}
        washerId={washer.id}
      />
    </DashboardShell>
  )
}

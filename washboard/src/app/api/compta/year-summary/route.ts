import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { materializeRecurring } from '@/lib/materializeRecurring'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: washer } = await supabase.from('washers').select('id').eq('user_id', user.id).single()
  if (!washer) return NextResponse.json({ error: 'Laveur introuvable' }, { status: 404 })

  const year = parseInt(req.nextUrl.searchParams.get('year') ?? String(new Date().getFullYear()))

  await materializeRecurring(supabase, washer.id, `${year}-01-01`, `${year}-12-31`)

  const [bookingsRes, expensesRes] = await Promise.all([
    supabase
      .from('bookings')
      .select('scheduled_at, booked_price, smart_discount, is_smart_slot')
      .eq('washer_id', washer.id)
      .eq('status', 'done')
      .gte('scheduled_at', `${year}-01-01T00:00:00`)
      .lte('scheduled_at', `${year}-12-31T23:59:59`),
    supabase
      .from('washer_expenses')
      .select('date, amount')
      .eq('washer_id', washer.id)
      .gte('date', `${year}-01-01`)
      .lte('date', `${year}-12-31`),
  ])

  const revenueByMonth: number[] = Array(12).fill(0)
  for (const b of bookingsRes.data ?? []) {
    const m = new Date(b.scheduled_at).getMonth()
    const price    = Number(b.booked_price ?? 0)
    const discount = b.is_smart_slot ? Number(b.smart_discount ?? 0) : 0
    revenueByMonth[m] += price - discount
  }

  const expensesByMonth: number[] = Array(12).fill(0)
  for (const e of expensesRes.data ?? []) {
    const m = new Date(e.date + 'T12:00:00').getMonth()
    expensesByMonth[m] += Number(e.amount)
  }

  const months = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    revenue:  revenueByMonth[i],
    expenses: expensesByMonth[i],
  }))

  return NextResponse.json({ months })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: washer } = await supabase.from('washers').select('id').eq('user_id', user.id).single()
  if (!washer) return NextResponse.json({ error: 'Laveur introuvable' }, { status: 404 })

  const start = req.nextUrl.searchParams.get('start')
  const end   = req.nextUrl.searchParams.get('end')
  if (!start || !end) return NextResponse.json({ revenue: 0 })

  const { data, error } = await supabase
    .from('bookings')
    .select('booked_price, smart_discount, is_smart_slot')
    .eq('washer_id', washer.id)
    .eq('status', 'done')
    .gte('scheduled_at', start + 'T00:00:00')
    .lte('scheduled_at', end + 'T23:59:59')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const revenue = (data ?? []).reduce((sum, b) => {
    const price    = Number(b.booked_price ?? 0)
    const discount = b.is_smart_slot ? Number(b.smart_discount ?? 0) : 0
    return sum + price - discount
  }, 0)

  return NextResponse.json({ revenue })
}

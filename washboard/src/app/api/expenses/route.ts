import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { materializeRecurring } from '@/lib/materializeRecurring'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: washer } = await supabase.from('washers').select('id').eq('user_id', user.id).single()
  if (!washer) return NextResponse.json({ error: 'Laveur introuvable' }, { status: 404 })

  const start = req.nextUrl.searchParams.get('start')
  const end   = req.nextUrl.searchParams.get('end')

  let query = supabase
    .from('washer_expenses')
    .select('*')
    .eq('washer_id', washer.id)
    .order('date', { ascending: false })

  if (start && end) await materializeRecurring(supabase, washer.id, start, end)

  if (start) query = query.gte('date', start)
  if (end)   query = query.lte('date', end)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ expenses: data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: washer } = await supabase.from('washers').select('id').eq('user_id', user.id).single()
  if (!washer) return NextResponse.json({ error: 'Laveur introuvable' }, { status: 404 })

  const { date, category, label, amount } = await req.json()
  if (!date || !category || !label || amount == null) {
    return NextResponse.json({ error: 'Champs manquants' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('washer_expenses')
    .insert({ washer_id: washer.id, date, category, label, amount: Number(amount) })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ expense: data }, { status: 201 })
}

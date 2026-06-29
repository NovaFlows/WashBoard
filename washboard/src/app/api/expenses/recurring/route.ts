import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: washer } = await supabase.from('washers').select('id').eq('user_id', user.id).single()
  if (!washer) return NextResponse.json({ error: 'Laveur introuvable' }, { status: 404 })

  const { data, error } = await supabase
    .from('washer_recurring_expenses')
    .select('*')
    .eq('washer_id', washer.id)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ recurring: data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: washer } = await supabase.from('washers').select('id').eq('user_id', user.id).single()
  if (!washer) return NextResponse.json({ error: 'Laveur introuvable' }, { status: 404 })

  const { category, label, amount, day_of_month } = await req.json()
  if (!category || !label || amount == null) {
    return NextResponse.json({ error: 'Champs manquants' }, { status: 400 })
  }
  if (!Number.isFinite(Number(amount)) || Number(amount) < 0) {
    return NextResponse.json({ error: 'Le montant doit être positif' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('washer_recurring_expenses')
    .insert({ washer_id: washer.id, category, label, amount: Number(amount), day_of_month: Number(day_of_month) || 1 })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ recurring: data }, { status: 201 })
}

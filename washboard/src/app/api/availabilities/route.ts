import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: washer } = await supabase
    .from('washers').select('id').eq('user_id', user.id).single()
  if (!washer) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

  const { day_of_week, start_time, end_time } = await request.json()
  if (day_of_week === undefined || !start_time || !end_time) {
    return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
  }
  if (Number(day_of_week) < 0 || Number(day_of_week) > 6) {
    return NextResponse.json({ error: 'Jour invalide' }, { status: 400 })
  }
  if (String(start_time) >= String(end_time)) {
    return NextResponse.json({ error: "L'heure de fin doit être après l'heure de début" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('availabilities')
    .insert({
      washer_id: washer.id,
      day_of_week: Number(day_of_week),
      start_time,
      end_time,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

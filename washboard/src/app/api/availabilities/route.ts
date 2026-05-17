import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: washer } = await admin()
    .from('washers').select('id').eq('user_id', user.id).single()
  if (!washer) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

  const { day_of_week, start_time, end_time } = await request.json()
  if (day_of_week === undefined || !start_time || !end_time) {
    return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
  }

  const { data, error } = await admin()
    .from('availabilities')
    .insert({
      id: randomUUID(),
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

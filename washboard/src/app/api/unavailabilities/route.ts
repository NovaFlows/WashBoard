import { NextRequest, NextResponse } from 'next/server'
import { errorResponse } from '@/lib/apiError'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: washer } = await supabase
    .from('washers').select('id').eq('user_id', user.id).single()
  if (!washer) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

  const { data, error } = await supabase
    .from('unavailabilities')
    .select('*')
    .eq('washer_id', washer.id)
    .order('start_date')

  // Un `data ?? []` muet ferait croire au laveur qu'il n'a aucun congé alors
  // que la lecture a échoué — il verrait ses absences disparaître de l'écran
  // sans comprendre pourquoi. C'est exactement le motif des bugs de production
  // de cette semaine (congés ignorés, GRANT manquant) : on refuse plutôt que
  // de répondre une liste vide trompeuse.
  if (error) {
    logger.error('unavailabilities.read_failed', { washerId: washer.id }, error)
    return NextResponse.json(
      { error: 'Impossible de charger vos absences. Réessayez dans un instant.' },
      { status: 503 },
    )
  }

  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: washer } = await supabase
    .from('washers').select('id').eq('user_id', user.id).single()
  if (!washer) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

  const { start_date, end_date, label, team_members_off } = await request.json()
  if (!start_date || !end_date || start_date > end_date)
    return NextResponse.json({ error: 'Dates invalides' }, { status: 400 })

  const { data, error } = await supabase
    .from('unavailabilities')
    .insert({ washer_id: washer.id, start_date, end_date, label: label?.trim() || null, team_members_off: Math.max(1, Number(team_members_off) || 1) })
    .select()
    .single()

  if (error) return errorResponse('unavailabilities.post.db', error)
  return NextResponse.json({ data }, { status: 201 })
}

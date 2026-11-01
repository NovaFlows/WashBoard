import { NextRequest, NextResponse } from 'next/server'
import { errorResponse } from '@/lib/apiError'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { migrationEnAttente } from '@/lib/migrationEnAttente'

/** "08:00" … "23:30" (heure de Paris). */
const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: washer, error: errWasher } = await supabase
    .from('washers').select('id').eq('user_id', user.id).single()

  if (errWasher) logger.error('unavailabilities.washer.read_failed', {}, errWasher)
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

  const { data: washer, error: errWasher } = await supabase
    .from('washers').select('id').eq('user_id', user.id).single()

  if (errWasher) logger.error('unavailabilities.washer.read_failed', {}, errWasher)
  if (!washer) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

  const { start_date, end_date, label, team_members_off, start_time, end_time } = await request.json()
  if (!start_date || !end_date || start_date > end_date)
    return NextResponse.json({ error: 'Dates invalides' }, { status: 400 })

  // Plage horaire : les deux heures ou aucune (journée entière).
  const avecHeures = start_time != null || end_time != null
  if (avecHeures) {
    const debut = typeof start_time === 'string' && HEURE.test(start_time) ? start_time : null
    const fin = typeof end_time === 'string' && HEURE.test(end_time) ? end_time : null
    if (!debut || !fin || fin <= debut)
      return NextResponse.json({ error: 'L’heure de fin doit être après l’heure de début' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('unavailabilities')
    .insert({
      washer_id: washer.id, start_date, end_date, label: label?.trim() || null, team_members_off: Math.max(1, Number(team_members_off) || 1),
      // Seulement pour une plage : sans la migration, une journée entière s'enregistre toujours.
      ...(avecHeures ? { start_time, end_time } : {}),
    })
    .select()
    .single()

  if (error && avecHeures && migrationEnAttente(error)) {
    logger.warn('unavailabilities.plage.migration_en_attente', { washerId: washer.id })
    return NextResponse.json(
      { error: 'Le blocage par plage horaire n’est pas encore disponible. Bloquez la journée entière en attendant.' },
      { status: 503 },
    )
  }
  if (error) return errorResponse('unavailabilities.post.db', error)
  return NextResponse.json({ data }, { status: 201 })
}

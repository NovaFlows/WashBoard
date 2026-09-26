import { NextRequest, NextResponse } from 'next/server'
import { errorResponse } from '@/lib/apiError'
import { revaliderPageReservation } from '@/lib/revaliderPageReservation'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { horaireAligne } from '@/lib/bookingWindow'

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: washer, error: errWasher } = await supabase
    .from('washers').select('id, slug').eq('user_id', user.id).single()

  if (errWasher) logger.error('availabilities.washer.read_failed', {}, errWasher)
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
  // Le formulaire pose déjà step="1800", mais un appel direct à cette route
  // (ou un navigateur qui ignore l'attribut) peut encore envoyer une minute
  // bâtarde — elle romprait silencieusement l'alignement sur le pas de 30 min
  // que suppose `generateSlots` côté réservation publique.
  if (!horaireAligne(String(start_time)) || !horaireAligne(String(end_time))) {
    return NextResponse.json({ error: 'Les horaires doivent être alignés sur 30 minutes' }, { status: 400 })
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

  if (error) return errorResponse('availabilities.post.db', error)
  revaliderPageReservation(washer.slug, 'availabilities.post')
  return NextResponse.json({ data })
}

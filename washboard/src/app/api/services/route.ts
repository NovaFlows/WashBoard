import { NextRequest, NextResponse } from 'next/server'
import { errorResponse } from '@/lib/apiError'
import { revaliderPageReservation } from '@/lib/revaliderPageReservation'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { estReservable, ERREUR_SANS_TYPE, dureeValide, ERREUR_DUREE_MAX } from '@/lib/prestation'

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: washer, error: errWasher } = await supabase
    .from('washers').select('id, slug').eq('user_id', user.id).single()

  if (errWasher) logger.error('services.washer.read_failed', {}, errWasher)
  if (!washer) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

  const { name, description, price, duration_minutes, vehicle_types, vehicle_price_overrides, addons, category_id } = await request.json()
  if (!name?.trim() || price === undefined || !duration_minutes) {
    return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
  }
  if (!estReservable({ vehicle_types })) {
    return NextResponse.json({ error: ERREUR_SANS_TYPE }, { status: 400 })
  }
  if (!dureeValide(Number(duration_minutes))) {
    return NextResponse.json({ error: ERREUR_DUREE_MAX }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('services')
    .insert({
      washer_id: washer.id,
      category_id: category_id ?? null,
      name: name.trim(),
      description: description?.trim() || null,
      price: Number(price),
      duration_minutes: Number(duration_minutes),
      vehicle_types: vehicle_types ?? [],
      vehicle_price_overrides: vehicle_price_overrides ?? {},
      addons: addons ?? [],
    })
    .select()
    .single()

  if (error) return errorResponse('services.post.db', error)
  revaliderPageReservation(washer.slug, 'services.post')
  return NextResponse.json({ data })
}

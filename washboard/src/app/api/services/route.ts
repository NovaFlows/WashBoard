import { NextRequest, NextResponse } from 'next/server'
import { errorResponse } from '@/lib/apiError'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { estReservable, ERREUR_SANS_TYPE, dureeValide, ERREUR_DUREE_MAX } from '@/lib/prestation'
import { quotaPrestations, quotaDepasse, PLAN_LABELS, planEffectif } from '@/lib/plan'

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: washer, error: errWasher } = await supabase
    .from('washers')
    .select('id, plan, grandfathered, slug, created_at, subscription_status, trial_ends_at, subscription_ends_at')
    .eq('user_id', user.id).single()

  if (errWasher) logger.error('services.washer.read_failed', {}, errWasher)
  if (!washer) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

  // ── Taille du catalogue selon l'offre ───────────────────────────────────
  //
  // Seule la CRÉATION est plafonnée. Un laveur qui rétrograde garde ses
  // prestations existantes et peut continuer à les modifier : lui en effacer
  // parce qu'il a changé d'offre casserait ses réservations en cours.
  const plafondCatalogue = quotaPrestations(washer)
  if (plafondCatalogue !== null) {
    const { count, error: errCount } = await supabase
      .from('services')
      .select('id', { count: 'exact', head: true })
      .eq('washer_id', washer.id)

    // Un comptage illisible refuse : sans le nombre, le plafond ne veut plus
    // rien dire, et laisser passer reviendrait à le supprimer en silence.
    if (errCount) {
      logger.error('services.count.read_failed', { washerId: washer.id }, errCount)
      return NextResponse.json(
        { error: 'Impossible de vérifier votre catalogue. Merci de réessayer dans un instant.' },
        { status: 503 },
      )
    }

    if (quotaDepasse(plafondCatalogue, count ?? 0)) {
      return NextResponse.json(
        {
          error: `L’offre ${PLAN_LABELS[planEffectif(washer)]} est limitée à ${plafondCatalogue} prestations. Passez à l’offre Starter pour un catalogue illimité.`,
          quota: { plafond: plafondCatalogue, utilisees: count ?? 0 },
        },
        { status: 403 },
      )
    }
  }

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
  return NextResponse.json({ data })
}

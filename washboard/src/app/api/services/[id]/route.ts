import { NextRequest, NextResponse } from 'next/server'
import { errorResponse } from '@/lib/apiError'
import { requireWasher } from '@/lib/requireWasher'
import { estReservable, ERREUR_SANS_TYPE, dureeValide, ERREUR_DUREE_MAX, erreurTropDActives } from '@/lib/prestation'
import { quotaPrestations, quotaDepasse } from '@/lib/plan'
import { logger } from '@/lib/logger'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireWasher()
  if (!auth.ok) return auth.response
  const { supabase, washerId } = auth.ctx

  const body = await request.json()
  if (body.vehicle_types !== undefined && !estReservable(body)) {
    return NextResponse.json({ error: ERREUR_SANS_TYPE }, { status: 400 })
  }
  if (body.duration_minutes !== undefined && !dureeValide(Number(body.duration_minutes))) {
    return NextResponse.json({ error: ERREUR_DUREE_MAX }, { status: 400 })
  }
  // ── Mise en veille / reactivation ───────────────────────────────────────
  //
  // Mettre en veille est TOUJOURS permis : c'est la sortie de secours d'un
  // laveur qui a trop de prestations pour son offre, on ne va pas la lui
  // fermer. Seule la REACTIVATION est plafonnee.
  if (body.en_veille === false) {
    const { data: washer, error: errWasher } = await supabase
      .from('washers')
      .select('plan, grandfathered, slug, created_at, subscription_status, trial_ends_at, subscription_ends_at')
      .eq('id', washerId).single()

    if (errWasher || !washer) {
      // Sans certitude sur l'offre, on ne reactive pas : laisser passer
      // reviendrait a lever le plafond des qu'une lecture echoue.
      logger.error('services.id.patch.washer_read_failed', { washerId }, errWasher)
      return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })
    }

    const plafond = quotaPrestations(washer)
    if (plafond !== null) {
      const { count, error: errCount } = await supabase
        .from('services')
        .select('id', { count: 'exact', head: true })
        .eq('washer_id', washerId)
        .eq('en_veille', false)
        .neq('id', id)   // celle qu'on reactive n'est pas encore comptee

      if (errCount) {
        logger.error('services.id.patch.count_failed', { washerId }, errCount)
        return NextResponse.json(
          { error: 'Impossible de verifier votre catalogue. Merci de reessayer dans un instant.' },
          { status: 503 },
        )
      }
      if (quotaDepasse(plafond, count ?? 0)) {
        return NextResponse.json({ error: erreurTropDActives(plafond) }, { status: 403 })
      }
    }
  }

  const updates: Record<string, unknown> = {}
  if (body.en_veille !== undefined) updates.en_veille = Boolean(body.en_veille)
  if (body.name !== undefined) updates.name = body.name.trim()
  if (body.category_id !== undefined) updates.category_id = body.category_id ?? null
  if (body.description !== undefined) updates.description = body.description?.trim() || null
  if (body.price !== undefined) updates.price = Number(body.price)
  if (body.duration_minutes !== undefined) updates.duration_minutes = Number(body.duration_minutes)
  if (body.vehicle_types !== undefined) updates.vehicle_types = body.vehicle_types
  if (body.vehicle_price_overrides !== undefined) updates.vehicle_price_overrides = body.vehicle_price_overrides
  if (body.addons !== undefined) updates.addons = body.addons

  const { error } = await supabase.from('services').update(updates).eq('id', id).eq('washer_id', washerId)
  if (error) return errorResponse('services.id.patch.db', error)
  return NextResponse.json({ success: true })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireWasher()
  if (!auth.ok) return auth.response
  const { supabase, washerId } = auth.ctx

  const { error } = await supabase.from('services').delete().eq('id', id).eq('washer_id', washerId)
  if (error) return errorResponse('services.id.delete.db', error)
  return NextResponse.json({ success: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { errorResponse } from '@/lib/apiError'
import { requireWasher } from '@/lib/requireWasher'
import { estReservable, ERREUR_SANS_TYPE, dureeValide, ERREUR_DUREE_MAX, erreurTropDActives } from '@/lib/prestation'
import { quotaPrestations, quotaDepasse } from '@/lib/plan'
import { compterPrestationsActives } from '@/lib/compterPrestations'
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
      // `id` est exclu du comptage : la prestation qu'on reactive n'est pas
      // encore active, la compter reviendrait a lui refuser sa propre place.
      const { count, error: errCount } = await compterPrestationsActives(supabase, washerId, id)

      if (errCount) {
        logger.error('services.id.patch.count_failed', { washerId }, errCount)
        return NextResponse.json(
          { error: 'Impossible de verifier votre catalogue. Merci de reessayer dans un instant.' },
          { status: 503 },
        )
      }
      if (quotaDepasse(plafond, count ?? 0)) {
        // `quota` accompagne le message : l'écran le reconnaît sans avoir à
        // lire le texte, et propose l'offre au lieu d'afficher une erreur
        // rouge de plus. Même forme que la création d'une prestation.
        return NextResponse.json(
          { error: erreurTropDActives(plafond), quota: { plafond, utilisees: count ?? 0 } },
          { status: 403 },
        )
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

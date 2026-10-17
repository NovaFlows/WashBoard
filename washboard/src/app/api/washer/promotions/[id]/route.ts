import { NextRequest, NextResponse } from 'next/server'
import { errorResponse } from '@/lib/apiError'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { uuidValide } from '@/lib/uuid'
import { COLONNES_PROMOTION, PromotionSaisieSchema, chevauche } from '@/lib/promotion'

// Modifier ou supprimer une promotion du laveur connecté. Toujours filtré sur SON
// `washer_id` en plus de l'`id` : une erreur d'identifiant ne peut pas atteindre un autre
// laveur (la RLS le garantit aussi).

async function contexte(params: Promise<{ id: string }>) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !uuidValide(id)) return { supabase, id, washerId: null as string | null }
  const { data: washer } = await supabase.from('washers').select('id').eq('user_id', user.id).maybeSingle()
  return { supabase, id, washerId: (washer?.id as string | undefined) ?? null }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, id, washerId } = await contexte(params)
  if (!washerId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const corps = await request.json().catch(() => null)
  const saisie = PromotionSaisieSchema.safeParse(corps)
  if (!saisie.success) {
    return NextResponse.json({ error: saisie.error.issues[0]?.message ?? 'Promotion invalide.' }, { status: 400 })
  }

  const { data: existantes, error: errLecture } = await supabase
    .from('promotions').select('id, nom, debut, fin').eq('washer_id', washerId)
  if (errLecture) return errorResponse('promotions.patch.read', errLecture, { washerId })
  const conflit = (existantes ?? []).find(p => p.id !== id && chevauche(p, saisie.data))
  if (conflit) {
    return NextResponse.json({ error: `Ces dates chevauchent la promotion « ${conflit.nom} ». Une seule promotion peut être en cours à la fois.` }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('promotions')
    .update({ ...saisie.data, service_ids: saisie.data.service_ids?.length ? saisie.data.service_ids : null })
    .eq('id', id).eq('washer_id', washerId)
    .select(COLONNES_PROMOTION)
    .maybeSingle()
  if (error) return errorResponse('promotions.patch.update', error, { washerId })
  if (!data) return NextResponse.json({ error: 'Promotion introuvable' }, { status: 404 })
  return NextResponse.json({ promotion: data })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, id, washerId } = await contexte(params)
  if (!washerId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data, error } = await supabase
    .from('promotions').delete().eq('id', id).eq('washer_id', washerId).select('id')
  if (error) return errorResponse('promotions.delete', error, { washerId })
  if (!data?.length) return NextResponse.json({ error: 'Promotion introuvable' }, { status: 404 })
  logger.info('promotions.deleted', { washerId })
  return NextResponse.json({ success: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { errorResponse } from '@/lib/apiError'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { migrationEnAttente, MESSAGE_EN_ATTENTE } from '@/lib/migrationEnAttente'
import { COLONNES_PROMOTION, PromotionSaisieSchema, chevauche } from '@/lib/promotion'

// Promotions du laveur connecté (voir lib/promotion.ts). Lecture et création ; la
// modification et la suppression sont dans `[id]/route.ts`. La RLS de `promotions` limite
// déjà chaque laveur à ses lignes ; le filtre `washer_id` est redit ici par prudence.

async function laveurConnecte() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, washerId: null as string | null }
  const { data: washer } = await supabase.from('washers').select('id').eq('user_id', user.id).maybeSingle()
  return { supabase, washerId: (washer?.id as string | undefined) ?? null }
}

export async function GET() {
  const { supabase, washerId } = await laveurConnecte()
  if (!washerId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data, error } = await supabase
    .from('promotions')
    .select(COLONNES_PROMOTION)
    .eq('washer_id', washerId)
    .order('debut', { ascending: false })

  if (error) {
    if (migrationEnAttente(error)) return NextResponse.json({ promotions: [], enAttente: true })
    return errorResponse('promotions.get', error, { washerId })
  }
  return NextResponse.json({ promotions: data ?? [] })
}

export async function POST(request: NextRequest) {
  const { supabase, washerId } = await laveurConnecte()
  if (!washerId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const corps = await request.json().catch(() => null)
  const saisie = PromotionSaisieSchema.safeParse(corps)
  if (!saisie.success) {
    return NextResponse.json({ error: saisie.error.issues[0]?.message ?? 'Promotion invalide.' }, { status: 400 })
  }

  const { data: existantes, error: errLecture } = await supabase
    .from('promotions').select('id, nom, debut, fin').eq('washer_id', washerId)
  if (errLecture) {
    if (migrationEnAttente(errLecture)) {
      logger.warn('promotions.migration_en_attente', { washerId })
      return NextResponse.json({ error: MESSAGE_EN_ATTENTE }, { status: 503 })
    }
    return errorResponse('promotions.post.read', errLecture, { washerId })
  }
  const conflit = (existantes ?? []).find(p => chevauche(p, saisie.data))
  if (conflit) {
    return NextResponse.json({ error: `Ces dates chevauchent la promotion « ${conflit.nom} ». Une seule promotion peut être en cours à la fois.` }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('promotions')
    .insert({ ...saisie.data, service_ids: saisie.data.service_ids?.length ? saisie.data.service_ids : null, washer_id: washerId })
    .select(COLONNES_PROMOTION)
    .single()
  if (error) return errorResponse('promotions.post.insert', error, { washerId })

  logger.info('promotions.created', { washerId })
  return NextResponse.json({ promotion: data }, { status: 201 })
}

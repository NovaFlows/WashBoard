import { NextRequest, NextResponse } from 'next/server'
import { errorResponse } from '@/lib/apiError'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { migrationEnAttente, MESSAGE_EN_ATTENTE } from '@/lib/migrationEnAttente'
import { ReglagesCentreAutoSchema } from '@/lib/centreAuto'

// Réglages « centre auto » du laveur connecté (lib/centreAuto.ts), rangés dans
// `washers.centre_auto`. Lus et écrits à part de la fiche, comme l'acompte : tant que la
// colonne n'existe pas, le reste fonctionne comme avant.

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data, error } = await supabase.from('washers').select('centre_auto').eq('user_id', user.id).maybeSingle()
  if (error) {
    if (migrationEnAttente(error)) return NextResponse.json({ centre_auto: null, enAttente: true })
    return errorResponse('washer.centre_auto.get', error, { userId: user.id })
  }
  return NextResponse.json({ centre_auto: data?.centre_auto ?? null })
}

export async function PUT(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const corps = await request.json().catch(() => null)
  const saisie = ReglagesCentreAutoSchema.safeParse(corps)
  if (!saisie.success) {
    return NextResponse.json({ error: saisie.error.issues[0]?.message ?? 'Réglages invalides.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('washers').update({ centre_auto: saisie.data }).eq('user_id', user.id).select('centre_auto')
  if (error) {
    if (migrationEnAttente(error)) {
      logger.warn('washer.centre_auto.migration_en_attente', { userId: user.id })
      return NextResponse.json({ error: MESSAGE_EN_ATTENTE }, { status: 503 })
    }
    return errorResponse('washer.centre_auto.put', error, { userId: user.id })
  }
  if (!data?.length) return NextResponse.json({ error: 'Enregistrement impossible. Réessayez.' }, { status: 500 })
  logger.info('washer.centre_auto.saved', { userId: user.id, actif: saisie.data.actif, lieux: saisie.data.lieux })
  return NextResponse.json({ centre_auto: data[0].centre_auto })
}

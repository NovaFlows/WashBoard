import { NextRequest, NextResponse } from 'next/server'
import { errorResponse } from '@/lib/apiError'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { migrationEnAttente, MESSAGE_EN_ATTENTE } from '@/lib/migrationEnAttente'
import { ReglagesAcompteSchema } from '@/lib/acompte'

// Réglages d'acompte du laveur connecté (lib/acompte.ts), rangés dans `washers.acompte`.
// Lus et écrits à part de la fiche : tant que la colonne n'existe pas, les autres réglages
// et la page de réservation fonctionnent comme avant.

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data, error } = await supabase.from('washers').select('acompte').eq('user_id', user.id).maybeSingle()
  if (error) {
    if (migrationEnAttente(error)) return NextResponse.json({ acompte: null, enAttente: true })
    return errorResponse('washer.acompte.get', error, { userId: user.id })
  }
  return NextResponse.json({ acompte: data?.acompte ?? null })
}

export async function PUT(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const corps = await request.json().catch(() => null)
  const saisie = ReglagesAcompteSchema.safeParse(corps)
  if (!saisie.success) {
    return NextResponse.json({ error: saisie.error.issues[0]?.message ?? 'Réglages invalides.' }, { status: 400 })
  }
  const reglages = { ...saisie.data, remboursement_heures: saisie.data.remboursable ? saisie.data.remboursement_heures : null }

  const { data, error } = await supabase
    .from('washers').update({ acompte: reglages }).eq('user_id', user.id).select('acompte')
  if (error) {
    if (migrationEnAttente(error)) {
      logger.warn('washer.acompte.migration_en_attente', { userId: user.id })
      return NextResponse.json({ error: MESSAGE_EN_ATTENTE }, { status: 503 })
    }
    return errorResponse('washer.acompte.put', error, { userId: user.id })
  }
  if (!data?.length) return NextResponse.json({ error: 'Enregistrement impossible. Réessayez.' }, { status: 500 })
  logger.info('washer.acompte.saved', { userId: user.id, actif: reglages.actif })
  return NextResponse.json({ acompte: data[0].acompte })
}

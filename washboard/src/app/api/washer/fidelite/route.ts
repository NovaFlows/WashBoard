import { NextRequest, NextResponse } from 'next/server'
import { errorResponse } from '@/lib/apiError'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { migrationEnAttente, MESSAGE_EN_ATTENTE } from '@/lib/migrationEnAttente'
import { ReglagesFideliteSchema } from '@/lib/fidelite'

// Réglages de la carte de fidélité du laveur connecté (lib/fidelite.ts), rangés dans
// `washers.fidelite`.
// Lus et écrits à part de la fiche : tant que la colonne n'existe pas, les autres réglages
// et la page de réservation fonctionnent comme avant.

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data, error } = await supabase.from('washers').select('fidelite').eq('user_id', user.id).maybeSingle()
  if (error) {
    if (migrationEnAttente(error)) return NextResponse.json({ fidelite: null, enAttente: true })
    return errorResponse('washer.fidelite.get', error, { userId: user.id })
  }
  return NextResponse.json({ fidelite: data?.fidelite ?? null })
}

export async function PUT(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const corps = await request.json().catch(() => null)
  const saisie = ReglagesFideliteSchema.safeParse(corps)
  if (!saisie.success) {
    return NextResponse.json({ error: saisie.error.issues[0]?.message ?? 'Réglages invalides.' }, { status: 400 })
  }
  const reglages = { ...saisie.data, valeur: saisie.data.recompense === 'offerte' ? 0 : saisie.data.valeur }

  const { data, error } = await supabase
    .from('washers').update({ fidelite: reglages }).eq('user_id', user.id).select('fidelite')
  if (error) {
    if (migrationEnAttente(error)) {
      logger.warn('washer.fidelite.migration_en_attente', { userId: user.id })
      return NextResponse.json({ error: MESSAGE_EN_ATTENTE }, { status: 503 })
    }
    return errorResponse('washer.fidelite.put', error, { userId: user.id })
  }
  if (!data?.length) return NextResponse.json({ error: 'Enregistrement impossible. Réessayez.' }, { status: 500 })
  logger.info('washer.fidelite.saved', { userId: user.id, actif: reglages.actif })
  return NextResponse.json({ fidelite: data[0].fidelite })
}

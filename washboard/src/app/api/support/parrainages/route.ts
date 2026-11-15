import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { isSupportMember } from '@/lib/supportAccess'
import { uuidValide } from '@/lib/uuid'
import { chargerArbreParrainages } from '@/lib/ficheLaveurDonnees'

// Arbre « qui a parrainé qui » de l'espace équipe, avec les signaux à vérifier.
// Réservé à l'équipe : contrôle AVANT d'ouvrir le client admin.
async function membreEquipe() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  if (!isSupportMember(user.id, process.env.SUPPORT_ADMIN_USER_IDS)) {
    logger.warn('support.parrainages.denied', { userId: user.id })
    return null
  }
  return user
}

export async function GET() {
  if (!(await membreEquipe())) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const arbre = await chargerArbreParrainages()
  if (!arbre) return NextResponse.json({ error: 'Impossible de charger les parrainages.' }, { status: 503 })
  return NextResponse.json(arbre)
}

/** « C'est normal » : les signaux de ces lignes ne remontent plus. */
export async function POST(request: Request) {
  const user = await membreEquipe()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const corps = await request.json().catch(() => null) as { lignes?: unknown } | null
  const lignes = Array.isArray(corps?.lignes) ? corps.lignes.filter((l): l is string => typeof l === 'string' && uuidValide(l)) : []
  if (!lignes.length || lignes.length > 200) return NextResponse.json({ error: 'Lignes invalides' }, { status: 400 })
  const { error } = await createAdminClient().from('parrainages').update({ signal_ok_le: new Date().toISOString() }).in('id', lignes)
  if (error) {
    logger.error('support.parrainages.signal_ok', { userId: user.id }, error)
    return NextResponse.json({ error: 'Enregistrement impossible. Réessayez.' }, { status: 500 })
  }
  logger.info('support.parrainages.signal_ok', { userId: user.id, lignes: lignes.length })
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { isSupportMember } from '@/lib/supportAccess'
import { uuidValide } from '@/lib/uuid'
import { validerAppel, tableAbsente } from '@/lib/suiviAppels'

// Enregistre un appel de l'équipe à un laveur (fiche laveur, espace équipe).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!isSupportMember(user.id, process.env.SUPPORT_ADMIN_USER_IDS)) {
    logger.warn('support.appels.post.denied', { userId: user.id })
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { id } = await params
  if (!uuidValide(id)) return NextResponse.json({ error: 'Laveur introuvable' }, { status: 404 })

  const saisie = validerAppel(await request.json().catch(() => null))
  if ('erreur' in saisie) return NextResponse.json({ error: saisie.erreur }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('suivi_appels')
    .insert({ ...saisie.appel, washer_id: id, auteur_id: user.id })
    .select('id, washer_id, appele_le, resultat, notes, prochaine_action, relancer_le')
    .single()

  if (error) {
    if (tableAbsente(error)) return NextResponse.json({ error: 'Le suivi d’appel n’est pas encore activé en base.' }, { status: 503 })
    // 23503 : le laveur n'existe pas (clé étrangère).
    if ((error as { code?: string }).code === '23503') return NextResponse.json({ error: 'Laveur introuvable' }, { status: 404 })
    logger.error('support.appels.post.write_failed', { washerId: id }, error)
    return NextResponse.json({ error: 'Enregistrement impossible. Réessayez.' }, { status: 500 })
  }
  logger.info('support.appels.cree', { washerId: id, resultat: saisie.appel.resultat })
  return NextResponse.json({ appel: data })
}

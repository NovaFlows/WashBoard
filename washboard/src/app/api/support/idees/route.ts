import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { isSupportMember } from '@/lib/supportAccess'
import { tableAbsente } from '@/lib/suiviAppels'
import { validerIdee } from '@/lib/tachesEquipe'

// Ajout d'une idée (espace équipe).
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!isSupportMember(user.id, process.env.SUPPORT_ADMIN_USER_IDS)) {
    logger.warn('support.idees.post.denied', { userId: user.id })
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const saisie = validerIdee(await request.json().catch(() => null))
  if ('erreur' in saisie) return NextResponse.json({ error: saisie.erreur }, { status: 400 })

  const { data, error } = await createAdminClient().from('idees_equipe').insert(saisie).select('id, titre, created_at').single()
  if (error) {
    if (tableAbsente(error)) return NextResponse.json({ error: 'Les idées ne sont pas encore activées en base.' }, { status: 503 })
    logger.error('support.idees.post.failed', {}, error)
    return NextResponse.json({ error: 'Enregistrement impossible. Réessayez.' }, { status: 500 })
  }
  logger.info('support.idees.create', { ideeId: data.id })
  return NextResponse.json({ idee: data })
}

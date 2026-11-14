import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { isSupportMember } from '@/lib/supportAccess'
import { tableAbsente } from '@/lib/suiviAppels'
import { validerTache } from '@/lib/tachesEquipe'

// Ajout d'une tâche à faire (espace équipe).
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!isSupportMember(user.id, process.env.SUPPORT_ADMIN_USER_IDS)) {
    logger.warn('support.taches.post.denied', { userId: user.id })
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const saisie = validerTache(await request.json().catch(() => null))
  if ('erreur' in saisie) return NextResponse.json({ error: saisie.erreur }, { status: 400 })

  const { data, error } = await createAdminClient().from('taches_equipe').insert(saisie).select('id, titre, assigne_a, created_at').single()
  if (error) {
    if (tableAbsente(error)) return NextResponse.json({ error: 'Les tâches ne sont pas encore activées en base.' }, { status: 503 })
    logger.error('support.taches.post.failed', {}, error)
    return NextResponse.json({ error: 'Enregistrement impossible. Réessayez.' }, { status: 500 })
  }
  logger.info('support.taches.create', { tacheId: data.id })
  return NextResponse.json({ tache: data })
}

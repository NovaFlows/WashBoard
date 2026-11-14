import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { isSupportMember } from '@/lib/supportAccess'
import { uuidValide } from '@/lib/uuid'
import { tableAbsente } from '@/lib/suiviAppels'

// Supprimer une tâche une fois faite.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isSupportMember(user.id, process.env.SUPPORT_ADMIN_USER_IDS)) {
    if (user) logger.warn('support.taches.delete.denied', { userId: user.id })
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const { id } = await params
  if (!uuidValide(id)) return NextResponse.json({ error: 'Tâche introuvable' }, { status: 404 })

  const { error } = await createAdminClient().from('taches_equipe').delete().eq('id', id)
  if (error) {
    if (tableAbsente(error)) return NextResponse.json({ error: 'Les tâches ne sont pas encore activées en base.' }, { status: 503 })
    logger.error('support.taches.delete.failed', { tacheId: id }, error)
    return NextResponse.json({ error: 'Suppression impossible. Réessayez.' }, { status: 500 })
  }
  logger.info('support.taches.delete', { tacheId: id })
  return NextResponse.json({ ok: true })
}

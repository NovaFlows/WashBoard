import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { isSupportMember } from '@/lib/supportAccess'
import { uuidValide } from '@/lib/uuid'

// Supprime un appel saisi par erreur (fiche laveur, espace équipe).
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!isSupportMember(user.id, process.env.SUPPORT_ADMIN_USER_IDS)) {
    logger.warn('support.appels.delete.denied', { userId: user.id })
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { id } = await params
  if (!uuidValide(id)) return NextResponse.json({ error: 'Appel introuvable' }, { status: 404 })

  const { error } = await createAdminClient().from('suivi_appels').delete().eq('id', id)
  if (error) {
    logger.error('support.appels.delete.failed', { appelId: id }, error)
    return NextResponse.json({ error: 'Suppression impossible. Réessayez.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

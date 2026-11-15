import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { isSupportMember } from '@/lib/supportAccess'
import { uuidValide } from '@/lib/uuid'
import { tableAbsente } from '@/lib/suiviAppels'
import { validerAssigne } from '@/lib/tachesEquipe'

async function equipe(action: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  if (!isSupportMember(user.id, process.env.SUPPORT_ADMIN_USER_IDS)) {
    logger.warn(`support.idees.${action}.denied`, { userId: user.id })
    return null
  }
  return user
}

const INACTIF = 'Les idées ne sont pas encore activées en base.'

// Supprimer une idée.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await equipe('delete'))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  if (!uuidValide(id)) return NextResponse.json({ error: 'Idée introuvable' }, { status: 404 })

  const { error } = await createAdminClient().from('idees_equipe').delete().eq('id', id)
  if (error) {
    if (tableAbsente(error)) return NextResponse.json({ error: INACTIF }, { status: 503 })
    logger.error('support.idees.delete.failed', { ideeId: id }, error)
    return NextResponse.json({ error: 'Suppression impossible. Réessayez.' }, { status: 500 })
  }
  logger.info('support.idees.delete', { ideeId: id })
  return NextResponse.json({ ok: true })
}

// Transférer une idée vers les tâches à faire, attribuée à quelqu'un : la tâche est
// créée, puis l'idée disparaît de la liste.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await equipe('transferer'))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  if (!uuidValide(id)) return NextResponse.json({ error: 'Idée introuvable' }, { status: 404 })

  const saisie = validerAssigne(await request.json().catch(() => null))
  if ('erreur' in saisie) return NextResponse.json({ error: saisie.erreur }, { status: 400 })

  const admin = createAdminClient()
  const { data: idee, error: lecture } = await admin.from('idees_equipe').select('titre').eq('id', id).maybeSingle()
  if (lecture) {
    if (tableAbsente(lecture)) return NextResponse.json({ error: INACTIF }, { status: 503 })
    logger.error('support.idees.transferer.read_failed', { ideeId: id }, lecture)
    return NextResponse.json({ error: 'Transfert impossible. Réessayez.' }, { status: 500 })
  }
  if (!idee) return NextResponse.json({ error: 'Idée introuvable' }, { status: 404 })

  const { data: tache, error: creation } = await admin.from('taches_equipe')
    .insert({ titre: idee.titre, assigne_a: saisie.assigne_a }).select('id, titre, assigne_a, created_at').single()
  if (creation) {
    if (tableAbsente(creation)) return NextResponse.json({ error: 'Les tâches ne sont pas encore activées en base.' }, { status: 503 })
    logger.error('support.idees.transferer.insert_failed', { ideeId: id }, creation)
    return NextResponse.json({ error: 'Transfert impossible. Réessayez.' }, { status: 500 })
  }

  const { error: suppression } = await admin.from('idees_equipe').delete().eq('id', id)
  if (suppression) {
    // Pas de doublon : on retire la tâche qu'on vient de créer.
    await admin.from('taches_equipe').delete().eq('id', tache.id)
    logger.error('support.idees.transferer.delete_failed', { ideeId: id }, suppression)
    return NextResponse.json({ error: 'Transfert impossible. Réessayez.' }, { status: 500 })
  }
  logger.info('support.idees.transferer', { ideeId: id, tacheId: tache.id })
  return NextResponse.json({ tache })
}

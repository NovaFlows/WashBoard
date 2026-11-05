import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { isSupportMember } from '@/lib/supportAccess'
import { uuidValide } from '@/lib/uuid'
import { tableAbsente } from '@/lib/suiviAppels'
import { validerResponsable } from '@/lib/responsables'

// Affilie un laveur à un membre de l'équipe (ou le désaffilie) — fiche laveur.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!isSupportMember(user.id, process.env.SUPPORT_ADMIN_USER_IDS)) {
    logger.warn('support.responsable.put.denied', { userId: user.id })
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { id } = await params
  if (!uuidValide(id)) return NextResponse.json({ error: 'Laveur introuvable' }, { status: 404 })

  const saisie = validerResponsable(await request.json().catch(() => null))
  if ('erreur' in saisie) return NextResponse.json({ error: saisie.erreur }, { status: 400 })

  const admin = createAdminClient()
  const { error } = saisie.responsable
    ? await admin.from('suivi_laveurs').upsert({ washer_id: id, responsable: saisie.responsable, modifie_par: user.id, updated_at: new Date().toISOString() })
    : await admin.from('suivi_laveurs').delete().eq('washer_id', id)

  if (error) {
    if (tableAbsente(error)) return NextResponse.json({ error: 'L’affiliation n’est pas encore activée en base.' }, { status: 503 })
    if ((error as { code?: string }).code === '23503') return NextResponse.json({ error: 'Laveur introuvable' }, { status: 404 })
    logger.error('support.responsable.put.failed', { washerId: id }, error)
    return NextResponse.json({ error: 'Enregistrement impossible. Réessayez.' }, { status: 500 })
  }
  logger.info('support.responsable.change', { washerId: id, responsable: saisie.responsable })
  return NextResponse.json({ ok: true })
}

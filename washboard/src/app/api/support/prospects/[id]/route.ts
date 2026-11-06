import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { isSupportMember } from '@/lib/supportAccess'
import { uuidValide } from '@/lib/uuid'
import { tableAbsente } from '@/lib/suiviAppels'
import { validerSaisie } from '@/lib/prospects'

// Modifier (étape, rappel, notes, coordonnées) ou supprimer un prospect.

async function equipe(action: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  if (!isSupportMember(user.id, process.env.SUPPORT_ADMIN_USER_IDS)) {
    logger.warn(`support.prospects.${action}.denied`, { userId: user.id })
    return null
  }
  return user
}

const INACTIF = 'La zone Prospects n’est pas encore activée en base.'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await equipe('patch'))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  if (!uuidValide(id)) return NextResponse.json({ error: 'Prospect introuvable' }, { status: 404 })

  const saisie = validerSaisie(await request.json().catch(() => null), false)
  if ('erreur' in saisie) return NextResponse.json({ error: saisie.erreur }, { status: 400 })
  if (Object.keys(saisie.champs).length === 0) return NextResponse.json({ error: 'Rien à modifier' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('prospects').update({ ...saisie.champs, updated_at: new Date().toISOString() }).eq('id', id).select('id')
  if (error) {
    if (tableAbsente(error)) return NextResponse.json({ error: INACTIF }, { status: 503 })
    if ((error as { code?: string }).code === '23505') return NextResponse.json({ error: 'Ce compte Instagram est déjà dans les prospects.' }, { status: 409 })
    logger.error('support.prospects.patch.failed', { prospectId: id }, error)
    return NextResponse.json({ error: 'Enregistrement impossible. Réessayez.' }, { status: 500 })
  }
  if (!data?.length) return NextResponse.json({ error: 'Prospect introuvable' }, { status: 404 })
  logger.info('support.prospects.update', { prospectId: id, champs: Object.keys(saisie.champs) })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await equipe('delete'))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  if (!uuidValide(id)) return NextResponse.json({ error: 'Prospect introuvable' }, { status: 404 })

  const admin = createAdminClient()
  const { error } = await admin.from('prospects').delete().eq('id', id)
  if (error) {
    if (tableAbsente(error)) return NextResponse.json({ error: INACTIF }, { status: 503 })
    logger.error('support.prospects.delete.failed', { prospectId: id }, error)
    return NextResponse.json({ error: 'Suppression impossible. Réessayez.' }, { status: 500 })
  }
  logger.info('support.prospects.delete', { prospectId: id })
  return NextResponse.json({ ok: true })
}

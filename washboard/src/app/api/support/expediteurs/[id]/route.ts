import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { isSupportMember } from '@/lib/supportAccess'
import { uuidValide } from '@/lib/uuid'

const DECISIONS = ['approuve', 'refuse'] as const

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  if (!isSupportMember(user.id, process.env.SUPPORT_ADMIN_USER_IDS)) {
    logger.warn('support.expediteurs.patch.denied', { userId: user.id })
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { id } = await params
  if (!uuidValide(id)) return NextResponse.json({ error: 'Laveur introuvable' }, { status: 404 })

  const corps = await request.json().catch(() => null)
  const decision = corps?.decision
  if (!DECISIONS.includes(decision)) {
    return NextResponse.json({ error: 'Décision inconnue' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: laveur, error: errLecture } = await admin
    .from('washers')
    .select('sms_sender_statut')
    .eq('id', id)
    .maybeSingle()

  if (errLecture) {
    logger.error('support.expediteurs.patch.read_failed', { washerId: id }, errLecture)
    return NextResponse.json({ error: 'Lecture impossible. Réessayez.' }, { status: 503 })
  }
  if (!laveur) return NextResponse.json({ error: 'Laveur introuvable' }, { status: 404 })
  if (laveur.sms_sender_statut !== 'en_attente') {
    return NextResponse.json({ error: 'Cette demande n’est plus en attente.' }, { status: 409 })
  }

  const { error } = await admin
    .from('washers')
    .update({ sms_sender_statut: decision })
    .eq('id', id)

  if (error) {
    logger.error('support.expediteurs.patch.write_failed', { washerId: id }, error)
    return NextResponse.json({ error: 'Enregistrement impossible. Réessayez.' }, { status: 500 })
  }
  logger.info('support.expediteurs.decision', { washerId: id, decision })
  return NextResponse.json({ statut: decision })
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { isSupportMember } from '@/lib/supportAccess'
import { tableAbsente } from '@/lib/suiviAppels'
import { validerSaisie } from '@/lib/prospects'

// Ajout d'un prospect à la main (zone Prospects de l'espace équipe).
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!isSupportMember(user.id, process.env.SUPPORT_ADMIN_USER_IDS)) {
    logger.warn('support.prospects.post.denied', { userId: user.id })
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const saisie = validerSaisie(await request.json().catch(() => null), true)
  if ('erreur' in saisie) return NextResponse.json({ error: saisie.erreur }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('prospects')
    .insert({ ...saisie.champs, source: saisie.champs.instagram ? 'instagram' : 'telephone' })
    .select('id').single()
  if (error) {
    if (tableAbsente(error)) return NextResponse.json({ error: 'La zone Prospects n’est pas encore activée en base.' }, { status: 503 })
    if ((error as { code?: string }).code === '42703') return NextResponse.json({ error: 'Le suivi des prospects par membre n’est pas encore activé en base.' }, { status: 503 })
    if ((error as { code?: string }).code === '23505') return NextResponse.json({ error: 'Ce compte Instagram est déjà dans les prospects.' }, { status: 409 })
    logger.error('support.prospects.post.failed', {}, error)
    return NextResponse.json({ error: 'Enregistrement impossible. Réessayez.' }, { status: 500 })
  }
  logger.info('support.prospects.create', { prospectId: data.id })
  return NextResponse.json({ id: data.id })
}

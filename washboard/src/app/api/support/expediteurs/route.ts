import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { isSupportMember } from '@/lib/supportAccess'

// Demandes de nom d'expéditeur SMS, à valider par l'équipe après l'approbation chez Brevo.
// Même contrôle que la boîte de réception : l'équipe n'existe pas en base, le contrôle
// applicatif passe avant toute ouverture du client admin.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  if (!isSupportMember(user.id, process.env.SUPPORT_ADMIN_USER_IDS)) {
    logger.warn('support.expediteurs.get.denied', { userId: user.id })
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('washers')
    .select('id, name, slug, sms_sender, sms_sender_statut')
    .neq('sms_sender_statut', 'aucun')
    .order('name')

  if (error) {
    logger.error('support.expediteurs.get.read_failed', {}, error)
    return NextResponse.json({ error: 'Impossible de charger les demandes. Réessayez.' }, { status: 503 })
  }
  return NextResponse.json({ demandes: data ?? [] })
}

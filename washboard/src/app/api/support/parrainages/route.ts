import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { isSupportMember } from '@/lib/supportAccess'
import { construireArbre, type LigneParrainage } from '@/lib/arbreParrainage'

// Arbre « qui a parrainé qui » de l'espace équipe, avec les signaux à vérifier.
// Réservé à l'équipe : contrôle AVANT d'ouvrir le client admin.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!isSupportMember(user.id, process.env.SUPPORT_ADMIN_USER_IDS)) {
    logger.warn('support.parrainages.denied', { userId: user.id })
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const admin = createAdminClient()
  const colonnesLaveur = 'id, name, plan, grandfathered, subscription_status, trial_ends_at, cgv_acceptees_ip, facture_siret'
  const { data, error } = await admin
    .from('parrainages')
    .select(`id, cree_le, ip_inscription, recompense_le, recompense_forme,
      parrain:washers!parrainages_parrain_id_fkey(${colonnesLaveur}),
      filleul:washers!parrainages_filleul_id_fkey(${colonnesLaveur})`)
    .order('cree_le', { ascending: true })
  if (error) {
    logger.error('support.parrainages.lecture', {}, error)
    return NextResponse.json({ error: 'Impossible de charger les parrainages.' }, { status: 503 })
  }

  return NextResponse.json(construireArbre((data ?? []) as unknown as LigneParrainage[]))
}

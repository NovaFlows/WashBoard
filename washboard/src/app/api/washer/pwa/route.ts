import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { migrationEnAttente } from '@/lib/migrationEnAttente'

// Le laveur vient d'ouvrir WashBoard en application installée (`SuiviPwa`, au plus une fois
// par jour et par appareil). Garde la date de la première ouverture (`pwa_installee_le`,
// jamais réécrite) et celle de la dernière (`pwa_derniere_ouverture_le`).
export async function POST() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const maintenant = new Date().toISOString()
  const { error } = await supabase
    .from('washers')
    .update({ pwa_derniere_ouverture_le: maintenant })
    .eq('user_id', user.id)
  if (error) {
    if (migrationEnAttente(error)) {
      logger.warn('washer.pwa.migration_en_attente', { userId: user.id })
      return NextResponse.json({ success: false }, { status: 503 })
    }
    logger.error('washer.pwa.write_failed', { userId: user.id }, error)
    return NextResponse.json({ error: 'Enregistrement impossible' }, { status: 500 })
  }

  // Première ouverture : posée une seule fois, le filtre `is null` empêche de la déplacer.
  const { error: erreurPremiere } = await supabase
    .from('washers')
    .update({ pwa_installee_le: maintenant })
    .eq('user_id', user.id)
    .is('pwa_installee_le', null)
  if (erreurPremiere) logger.error('washer.pwa.first_write_failed', { userId: user.id }, erreurPremiere)

  return NextResponse.json({ success: true })
}

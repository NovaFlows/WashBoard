import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { migrationEnAttente } from '@/lib/migrationEnAttente'

// Dernière connexion du laveur (demande d'Alexandre, 2026-10-21 : « savoir la dernière
// connexion »). Appelée par `SuiviConnexion` quand le tableau de bord s'ouvre, au plus une fois
// par demi-heure et par appareil : `washers.derniere_connexion_le`.
//
// Pourquoi pas `last_sign_in_at` de Supabase : il ne bouge qu'à la saisie du mot de passe. Un
// laveur resté connecté des semaines y garde la date de son inscription.
//
// Limite connue : une session ouverte par l'équipe (accès support, lien magique sur le compte du
// laveur) compte aussi — rare, sur demande du laveur, et tracée dans `support_access_grants`.
export async function POST() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { error } = await supabase
    .from('washers')
    .update({ derniere_connexion_le: new Date().toISOString() })
    .eq('user_id', user.id)
  if (error) {
    if (migrationEnAttente(error)) {
      logger.warn('washer.connexion.migration_en_attente', { userId: user.id })
      return NextResponse.json({ success: false }, { status: 503 })
    }
    logger.error('washer.connexion.write_failed', { userId: user.id }, error)
    return NextResponse.json({ error: 'Enregistrement impossible' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}

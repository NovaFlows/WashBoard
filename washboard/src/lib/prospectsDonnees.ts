import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { tableAbsente } from '@/lib/suiviAppels'
import type { Prospect } from '@/lib/prospects'

// Lecture de la zone Prospects (service_role : la table n'est ouverte à aucun autre
// rôle). Toujours précédée de `exigerEquipe` dans les pages.

export const COLONNES_PROSPECT = 'id, instagram, nom, ville, telephone, statut, source, message, reponse, notes, contacte_le, repondu_le, relancer_le, created_at, updated_at'

/** `actif` est faux tant que la table `prospects` n'existe pas en base. */
export async function chargerProspects(): Promise<{ prospects: Prospect[]; actif: boolean }> {
  const admin = createAdminClient()
  const { data, error } = await admin.from('prospects').select(COLONNES_PROSPECT).order('updated_at', { ascending: false }).limit(5000)
  if (error) {
    if (tableAbsente(error)) return { prospects: [], actif: false }
    logger.error('equipe.prospects.read_failed', {}, error)
    throw error
  }
  return { prospects: (data ?? []) as Prospect[], actif: true }
}

import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { tableAbsente } from '@/lib/suiviAppels'
import type { Prospect } from '@/lib/prospects'

// Lecture de la zone Prospects (service_role : la table n'est ouverte à aucun autre
// rôle). Toujours précédée de `exigerEquipe` dans les pages.

export const COLONNES_PROSPECT = 'id, instagram, nom, ville, telephone, statut, source, message, reponse, notes, contacte_le, repondu_le, relancer_le, created_at, updated_at'

/** Lecture de l'espace équipe : avec « suivi par ». Le flux de l'agent garde COLONNES_PROSPECT, pour ne jamais dépendre de cette colonne. */
const COLONNES_EQUIPE = `${COLONNES_PROSPECT}, responsable`
const COLONNE_ABSENTE = '42703'

/** `actif` est faux tant que la table `prospects` n'existe pas en base. */
export async function chargerProspects(): Promise<{ prospects: Prospect[]; actif: boolean }> {
  const admin = createAdminClient()
  let { data, error } = await admin.from('prospects').select(COLONNES_EQUIPE).order('updated_at', { ascending: false }).limit(5000)
  // Colonne « responsable » pas encore créée : la zone fonctionne, sans affiliation.
  if ((error as { code?: string } | null)?.code === COLONNE_ABSENTE) {
    ;({ data, error } = await admin.from('prospects').select(COLONNES_PROSPECT).order('updated_at', { ascending: false }).limit(5000))
  }
  if (error) {
    if (tableAbsente(error)) return { prospects: [], actif: false }
    logger.error('equipe.prospects.read_failed', {}, error)
    throw error
  }
  return { prospects: (data ?? []) as Prospect[], actif: true }
}

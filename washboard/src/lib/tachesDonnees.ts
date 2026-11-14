import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { tableAbsente } from '@/lib/suiviAppels'
import type { Tache } from '@/lib/tachesEquipe'

/** `actif` est faux tant que la table `taches_equipe` n'existe pas en base. Toujours précédée de `exigerEquipe`. */
export async function chargerTaches(): Promise<{ taches: Tache[]; actif: boolean }> {
  const { data, error } = await createAdminClient()
    .from('taches_equipe').select('id, titre, assigne_a, created_at').order('created_at', { ascending: true }).limit(500)
  if (error) {
    if (tableAbsente(error)) return { taches: [], actif: false }
    logger.error('equipe.taches.read_failed', {}, error)
    return { taches: [], actif: true }
  }
  return { taches: (data ?? []) as Tache[], actif: true }
}

// Lecture du fuseau d'un laveur côté serveur.
//
// Le fuseau n'est pas stocké : il se déduit de l'adresse de départ et du
// téléphone (lib/fuseaux.ts). On ne lit donc que ces deux colonnes, qui
// existent depuis toujours. Une lecture en échec retombe sur Paris —
// exactement le comportement d'avant.

import type { SupabaseClient } from '@supabase/supabase-js'
import { fuseauDuLaveur, type SourceFuseau } from './fuseaux'

const COLONNES = 'base_address, phone'

/** Le fuseau du laveur `washers.id = washerId` (Paris en cas de doute). */
export async function lireFuseauLaveur(client: SupabaseClient, washerId: string): Promise<string> {
  try {
    const { data, error } = await client.from('washers').select(COLONNES).eq('id', washerId).maybeSingle()
    if (error) return fuseauDuLaveur(null)
    return fuseauDuLaveur(data as SourceFuseau | null)
  } catch {
    return fuseauDuLaveur(null)
  }
}

/** Même lecture pour plusieurs laveurs d'un coup (crons) : id → fuseau.
 *  Un laveur absent de la réponse vaut Paris. */
export async function lireFuseauxLaveurs(client: SupabaseClient, washerIds: string[]): Promise<Map<string, string>> {
  const resultat = new Map<string, string>()
  const ids = [...new Set(washerIds)].filter(Boolean)
  if (ids.length === 0) return resultat
  try {
    const { data, error } = await client.from('washers').select(`id, ${COLONNES}`).in('id', ids)
    if (error || !data) return resultat
    for (const ligne of data as ({ id: string } & SourceFuseau)[]) {
      resultat.set(ligne.id, fuseauDuLaveur(ligne))
    }
  } catch {
    // Paris pour tout le monde : le comportement d'avant.
  }
  return resultat
}

/** Raccourci de lecture d'une Map rendue par `lireFuseauxLaveurs`. */
export function fuseauDans(fuseaux: Map<string, string>, washerId: string | null | undefined): string {
  return (washerId && fuseaux.get(washerId)) || fuseauDuLaveur(null)
}

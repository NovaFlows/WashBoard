// Lecture du fuseau d'un laveur côté serveur.
//
// Lu À PART de la fiche, comme l'acompte ou le centre auto : tant que la
// colonne `washers.fuseau` n'existe pas en base, la requête échoue ici sans
// faire tomber la lecture du laveur ni la page, et l'on retombe sur Paris —
// exactement le comportement d'avant. Rien ne peut donc décaler un laveur
// existant tant qu'il n'a pas, lui, choisi un autre fuseau.

import type { SupabaseClient } from '@supabase/supabase-js'
import { fuseauDuLaveur } from './fuseaux'

/** Le fuseau du laveur `washers.id = washerId` (Paris en cas de doute). */
export async function lireFuseauLaveur(client: SupabaseClient, washerId: string): Promise<string> {
  try {
    const { data, error } = await client.from('washers').select('fuseau').eq('id', washerId).maybeSingle()
    if (error) return fuseauDuLaveur(null)
    return fuseauDuLaveur(data as { fuseau?: string | null } | null)
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
    const { data, error } = await client.from('washers').select('id, fuseau').in('id', ids)
    if (error || !data) return resultat
    for (const ligne of data as { id: string; fuseau?: string | null }[]) {
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

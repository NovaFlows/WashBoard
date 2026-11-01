import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js'
import { migrationEnAttente } from '@/lib/migrationEnAttente'
import type { DayUnavailability } from '@/lib/slots'

type Blocage = DayUnavailability & { id?: string }

/** Absences d'un laveur, avec leurs heures quand la colonne existe.
 *  Avant la migration (`start_time`/`end_time` absentes), relit sans : chaque
 *  absence reste alors une journée entière, comme avant. Jamais le motif,
 *  qui ne regarde pas le client. */
export async function lireBlocages(
  client: SupabaseClient,
  washerId: string,
  { avecId = false }: { avecId?: boolean } = {},
): Promise<{ data: Blocage[] | null; error: PostgrestError | null }> {
  const base = `${avecId ? 'id, ' : ''}start_date, end_date, team_members_off`
  const complet = await client.from('unavailabilities').select(`${base}, start_time, end_time`).eq('washer_id', washerId)
  if (!complet.error || !migrationEnAttente(complet.error)) {
    return { data: (complet.data ?? null) as Blocage[] | null, error: complet.error }
  }
  const sansHeures = await client.from('unavailabilities').select(base).eq('washer_id', washerId)
  return { data: (sansHeures.data ?? null) as Blocage[] | null, error: sansHeures.error }
}

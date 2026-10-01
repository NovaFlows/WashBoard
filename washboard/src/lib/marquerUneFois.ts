// Poser une date de fin (onboarding, visite guidée) sur la fiche du laveur, une
// seule fois : un double clic, un retour arrière ou un second onglet ne
// réécrivent jamais la première date.

import type { SupabaseClient } from '@supabase/supabase-js'

export type ColonneUneFois = 'onboarding_complete_at' | 'dashboard_tour_complete_at'

export type ResultatMarquage =
  | { ok: true }
  | { ok: false; cause: 'ecriture' | 'non_enregistre'; erreur: unknown }

export async function marquerUneFois(
  db: SupabaseClient,
  userId: string,
  colonne: ColonneUneFois,
  autresValeurs: Record<string, unknown> = {},
): Promise<ResultatMarquage> {
  const { data: misesAJour, error } = await db
    .from('washers')
    .update({ ...autresValeurs, [colonne]: new Date().toISOString() })
    .eq('user_id', userId)
    .is(colonne, null)
    .select('id')

  if (error) return { ok: false, cause: 'ecriture', erreur: error }
  if (misesAJour?.length) return { ok: true }

  // Aucune ligne touchée : soit la date était déjà posée (double envoi), soit
  // l'écriture a été écartée sans erreur — une policy RLS filtre les lignes au
  // lieu de refuser. Dans ce second cas, l'écran reviendrait à chaque connexion
  // sans que rien ne le signale.
  const { data: fiche, error: erreurLecture } = await db
    .from('washers')
    .select(colonne)
    .eq('user_id', userId)
    .maybeSingle()

  if (erreurLecture) return { ok: false, cause: 'non_enregistre', erreur: erreurLecture }
  if (!(fiche as Record<string, unknown> | null)?.[colonne]) {
    return { ok: false, cause: 'non_enregistre', erreur: new Error('aucune ligne mise à jour') }
  }
  return { ok: true }
}

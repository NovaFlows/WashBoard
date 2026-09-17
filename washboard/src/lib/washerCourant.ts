// Lecture de la fiche laveur du visiteur connecté, pour les pages du tableau
// de bord.
//
// Le point important n'est pas la requête, c'est la distinction entre « ce
// compte n'existe pas » et « la lecture a échoué ». Les pages écrivaient
// toutes la même chose :
//
//     const { data: washer } = await supabase.from('washers')...
//     if (!washer) redirect('/login')
//
// Un simple raté réseau — au réveil de l'application installée, typiquement —
// tombait donc dans le même `if` qu'un compte supprimé, et **déconnectait le
// laveur**. Le cas a été corrigé une fois sur la page d'accueil le 2026-09-xx ;
// il vivait encore dans neuf autres pages. Cette fonction porte la règle une
// seule fois, pour qu'elle ne puisse plus diverger d'un écran à l'autre.

import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from './logger'

/** Code PostgREST « aucune ligne » : le seul cas où le profil manque vraiment. */
const AUCUNE_LIGNE = 'PGRST116'

/**
 * @param page   nom de l'écran, pour retrouver la panne dans les journaux.
 * @param colonnes colonnes à lire (chaîne littérale Supabase).
 * @throws si la lecture échoue vraiment : l'écran « Réessayer » s'affiche et la
 *         session reste intacte, au lieu d'une déconnexion silencieuse.
 */
// Le client Supabase n'est pas typé dans ce projet : les pages lisent `washer.name`,
// `washer.plan` et une vingtaine d'autres colonnes. Un type strict ici les
// casserait toutes sans rien garantir de plus.
export async function washerDuUtilisateur(
  supabase: SupabaseClient,
  userId: string,
  page: string,
  colonnes = '*',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const { data: washer, error } = await supabase
    .from('washers')
    .select(colonnes)
    .eq('user_id', userId)
    .single()

  if (error && error.code !== AUCUNE_LIGNE) {
    logger.error('dashboard.washer.read_failed', { page, userId }, error)
    throw new Error('Lecture du profil laveur impossible')
  }

  // Session orpheline (fiche supprimée, session encore active) : on déconnecte
  // pour éviter la boucle « profil introuvable ».
  if (!washer) redirect('/api/auth/logout')

  return washer
}

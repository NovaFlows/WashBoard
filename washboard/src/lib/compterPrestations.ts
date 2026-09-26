import type { SupabaseClient } from '@supabase/supabase-js'

/** Code Postgres « colonne inconnue ».
 *
 *  Ici, il ne veut dire qu'une chose : la migration 005 n'a pas encore tourné
 *  sur cette base, la colonne `en_veille` n'existe pas. Ce n'est pas une
 *  panne, c'est un état transitoire connu — entre le déploiement du code et
 *  l'exécution du SQL, ou l'inverse. */
export const COLONNE_INCONNUE = '42703'

/** Combien de prestations comptent pour le plafond de l'offre.
 *
 *  Le comptage écarte les prestations en veille. Tant que la colonne n'existe
 *  pas, il compte TOUT — c'est-à-dire exactement ce que faisait le code avant
 *  la mise en veille, donc rien ne casse ni dans un sens ni dans l'autre.
 *
 *  Sans ce repli, l'ordre de déploiement devenait une contrainte dure : code
 *  d'abord et la création de prestation renvoyait une erreur à tous les
 *  comptes plafonnés, SQL d'abord et il fallait n'oublier ni l'un ni l'autre.
 *  Une base de production ne devrait jamais dépendre d'un ordre qu'on doit se
 *  rappeler.
 *
 *  ⚠️ Le repli ne peut PAS se fier au code d'erreur. Un comptage passe par
 *  `head: true`, donc PostgREST répond sans corps, et la bibliothèque n'a rien
 *  à analyser : on récupère un 400 avec un message vide, jamais le `42703`
 *  attendu. On rejoue donc la requête sans le filtre, et si elle passe, c'est
 *  que le filtre était le seul problème. Un raté passager du premier appel
 *  ferait au pire compter les prestations en veille — plus strict, jamais plus
 *  permissif.
 *
 *  @param exclureId prestation à ne pas compter — celle qu'on réactive n'est
 *                   pas encore active, la compter reviendrait à lui refuser la
 *                   place qu'elle demande.
 */
export async function compterPrestationsActives(
  // Le client Supabase n'est pas typé dans ce projet (voir washerCourant).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  washerId: string,
  exclureId?: string,
): Promise<{ count: number | null; error: unknown }> {
  const base = () => {
    let q = supabase.from('services').select('id', { count: 'exact', head: true }).eq('washer_id', washerId)
    if (exclureId) q = q.neq('id', exclureId)
    return q
  }

  const avecVeille = await base().eq('en_veille', false)
  if (!avecVeille.error) return { count: avecVeille.count, error: null }

  const sansVeille = await base()
  return { count: sansVeille.count, error: sansVeille.error }
}

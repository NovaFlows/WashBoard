// Lecture complète d'une requête Supabase, page par page.
//
// L'API Supabase plafonne chaque réponse à 1 000 lignes, et le fait sans
// erreur ni avertissement : on reçoit les 1 000 premières, point. Constaté le
// 2026-09-12 sur le CRM de Kookii Clean — 5 659 événements de visite en base,
// 1 000 transmis à la page, et des statistiques de visite figées au
// 1er septembre sans que rien ne le signale.
//
// La requête DOIT être triée sur une clé unique (par exemple `created_at` puis
// `id`) : sans ordre stable, deux pages successives peuvent se chevaucher ou
// laisser des trous.

export const TAILLE_PAGE = 1000

/** Garde-fou : au-delà de 200 pages (200 000 lignes), on s'arrête plutôt que
 *  de boucler indéfiniment sur une requête qui ne finirait jamais. */
const PAGES_MAX = 200

type Reponse<T> = { data: T[] | null; error: unknown }

/**
 * Enchaîne les pages jusqu'à la dernière.
 *
 * @param lirePage reçoit les bornes incluses d'une page, à passer à `.range()`.
 * @returns toutes les lignes lues, l'erreur éventuelle, et `tronque` quand la
 *          lecture s'est arrêtée avant la fin — sur erreur ou sur le garde-fou.
 *          Les lignes déjà lues sont rendues même en cas d'erreur : l'appelant
 *          décide s'il affiche un résultat partiel, mais il le sait.
 */
export async function toutesLesLignes<T>(
  lirePage: (debut: number, fin: number) => PromiseLike<Reponse<T>>,
  taille: number = TAILLE_PAGE,
): Promise<{ data: T[]; error: unknown; tronque: boolean }> {
  const lignes: T[] = []
  for (let page = 0; page < PAGES_MAX; page++) {
    const debut = page * taille
    const { data, error } = await lirePage(debut, debut + taille - 1)
    if (error) return { data: lignes, error, tronque: true }
    const lot = data ?? []
    lignes.push(...lot)
    // Une page incomplète est la dernière. Une page pleine peut l'être aussi :
    // on lit alors une page de plus, qui revient vide.
    if (lot.length < taille) return { data: lignes, error: null, tronque: false }
  }
  return { data: lignes, error: null, tronque: true }
}

import type { ServiceAddon } from '@/types'

// Les options d'une prestation, rangées par rubrique (« Intérieur & habitable »,
// « Protections & finitions »…) pour que le client ne se perde pas dans une longue liste.
// La rubrique est le champ `category` de l'option : le laveur la choisit déjà à l'ajout.

/** Au-delà de ce nombre d'options, et à partir de deux rubriques, la page client les
 *  range en dépliants. En dessous, la liste reste telle qu'elle est : replier trois
 *  options derrière deux touchers serait un détour, pas une aide. */
export const SEUIL_OPTIONS_EN_DEPLIANTS = 6

/** Longueur maximale de la description d'une option (une phrase, pas un paragraphe). */
export const DESCRIPTION_OPTION_MAX = 140

/** « Suppléments intérieur » et « supplements  Interieur » sont la même rubrique. */
function cle(texte: string): string {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
}

export type RubriqueOptions = { nom: string; options: ServiceAddon[] }

/** Les options groupées par rubrique, dans l'ordre où le laveur les a saisies (la
 *  rubrique prend la place et l'orthographe de sa première option). */
export function rubriquesDesOptions(options: ServiceAddon[]): RubriqueOptions[] {
  const rubriques: RubriqueOptions[] = []
  const index = new Map<string, RubriqueOptions>()
  for (const o of options) {
    const nom = (o.category ?? '').replace(/\s+/g, ' ').trim()
    const k = cle(nom)
    let r = index.get(k)
    if (!r) { r = { nom, options: [] }; index.set(k, r); rubriques.push(r) }
    r.options.push(o)
  }
  return rubriques
}

/** Faut-il ranger ces options en dépliants ? */
export function enDepliants(rubriques: RubriqueOptions[]): boolean {
  return rubriques.length > 1 && rubriques.reduce((n, r) => n + r.options.length, 0) > SEUIL_OPTIONS_EN_DEPLIANTS
}

/** Description saisie → texte propre, ou `undefined` si vide (le champ n'est alors pas écrit). */
export function descriptionOptionNettoyee(saisie: unknown): string | undefined {
  if (typeof saisie !== 'string') return undefined
  const propre = saisie.replace(/\s+/g, ' ').trim().slice(0, DESCRIPTION_OPTION_MAX)
  return propre || undefined
}

/** Options reçues d'un écran d'édition : description nettoyée, vide retirée. Le reste est inchangé. */
export function optionsAvecDescriptionsNettoyees<T extends { description?: unknown }>(options: T[]): T[] {
  return options.map(o => {
    const { description, ...reste } = o
    const propre = descriptionOptionNettoyee(description)
    return (propre ? { ...reste, description: propre } : reste) as T
  })
}

import type { Dictionnaire } from '../../traduire'
import type { Langue } from '../../langues'

// Textes des articles du blog (un fichier par langue, chargé à la demande par `getTArticle`).
export async function dictionnaireArticles(langue: Langue): Promise<Dictionnaire> {
  if (langue === 'en') return (await import('./en')).enArticles
  if (langue === 'es') return (await import('./es')).esArticles
  if (langue === 'de') return (await import('./de')).deArticles
  return {}
}

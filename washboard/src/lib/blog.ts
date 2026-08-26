// Index des articles du blog.
//
// Source unique pour la liste /blog, les liens internes et le sitemap : sans ça,
// publier un article obligerait à penser à trois endroits, et le sitemap finirait
// par mentir sur ce que le site contient réellement.

export type Article = {
  slug: string
  title: string
  description: string
  /** Format ISO, sert au sitemap et aux données structurées. */
  publishedAt: string
  updatedAt: string
  readingMinutes: number
}

export const SITE_URL = 'https://washboard.fr'

export const ARTICLES: Article[] = [
  {
    slug: 'trouver-des-clients-laveur-auto-mobile',
    title: 'Comment trouver des clients quand on est laveur auto mobile',
    description:
      'Les canaux qui remplissent vraiment un agenda de lavage auto à domicile : fiche Google, avis clients, zones groupées, clients pros et relance des anciens clients. Sans budget publicitaire.',
    publishedAt: '2026-08-26',
    updatedAt: '2026-08-26',
    readingMinutes: 9,
  },
]

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find(a => a.slug === slug)
}

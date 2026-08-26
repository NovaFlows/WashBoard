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
  {
    slug: 'tarifs-lavage-auto-domicile',
    title: 'Quels tarifs pratiquer en lavage auto à domicile',
    description:
      'Comment calculer un prix qui tient : temps réel par prestation, frais de déplacement, charges et cotisations. Avec une grille indicative et les erreurs qui plombent une marge.',
    publishedAt: '2026-08-26',
    updatedAt: '2026-08-26',
    readingMinutes: 8,
  },
  {
    slug: 'devenir-laveur-auto-mobile',
    title: 'Devenir laveur auto mobile : par où commencer',
    description:
      'Statut, assurance, matériel, réglementation sur l’eau, budget de départ : les étapes concrètes pour lancer une activité de lavage auto à domicile sans se tromper.',
    publishedAt: '2026-08-26',
    updatedAt: '2026-08-26',
    readingMinutes: 10,
  },
  {
    slug: 'organiser-ses-tournees-lavage-auto',
    title: 'Organiser ses tournées pour laver plus de voitures par jour',
    description:
      'Les trajets entre deux rendez-vous mangent une à deux prestations par jour. Comment grouper ses créneaux par secteur, prévoir des durées réalistes et absorber les annulations.',
    publishedAt: '2026-08-26',
    updatedAt: '2026-08-26',
    readingMinutes: 7,
  },
]

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find(a => a.slug === slug)
}

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

// Source unique du domaine : defini dans plan.ts, re-exporte ici par commodite
// pour les pages du blog qui l utilisent deja sous ce nom.
export { SITE_URL_FALLBACK as SITE_URL } from '@/lib/plan'

export const ARTICLES: Article[] = [
  {
    slug: 'lavage-auto-sans-eau',
    title: 'Lavage auto sans eau : comment ça marche, pour qui, avec quoi',
    description:
      'Le lavage sans eau règle la question des eaux usées et permet d’intervenir partout. Principe, produits, limites (véhicule très sale, jantes), temps par voiture et argumentaire client.',
    publishedAt: '2026-09-20',
    updatedAt: '2026-09-20',
    readingMinutes: 8,
  },
  {
    slug: 'combien-gagne-un-laveur-auto-mobile',
    title: 'Combien gagne un laveur auto mobile ? Revenus réels et simulation',
    description:
      'Chiffre d’affaires, charges, cotisations, revenu net : une simulation honnête sur 3 profils (débutant, installé, avec clients pros) et les trois leviers qui font vraiment monter le revenu.',
    publishedAt: '2026-09-20',
    updatedAt: '2026-09-20',
    readingMinutes: 9,
  },
  {
    slug: 'fiche-google-laveur-auto-mobile',
    title: 'Fiche Google pour laveur auto mobile : la configurer pour recevoir des appels',
    description:
      'Zone de service au lieu d’une adresse, catégorie, photos, avis, réponses : le guide pas à pas pour qu’une fiche d’établissement Google amène des réservations de lavage à domicile.',
    publishedAt: '2026-09-20',
    updatedAt: '2026-09-20',
    readingMinutes: 8,
  },
  {
    slug: 'assurance-laveur-auto-mobile',
    title: 'Quelle assurance pour un laveur auto mobile',
    description:
      'RC pro, garantie biens confiés, véhicule à usage professionnel, matériel : ce qu’il faut vraiment couvrir quand on lave des voitures à domicile, les exclusions à vérifier et les bons réflexes en cas de dommage.',
    publishedAt: '2026-09-20',
    updatedAt: '2026-09-20',
    readingMinutes: 7,
  },
  {
    slug: 'trouver-des-clients-laveur-auto-mobile',
    title: 'Comment trouver des clients quand on est laveur auto mobile',
    description:
      'Les canaux qui remplissent vraiment un agenda de lavage auto à domicile : fiche Google, avis clients, zones groupées, clients pros et relance des anciens clients. Sans budget publicitaire.',
    publishedAt: '2026-08-26',
    updatedAt: '2026-09-20',
    readingMinutes: 10,
  },
  {
    slug: 'tarifs-lavage-auto-domicile',
    title: 'Quels tarifs pratiquer en lavage auto à domicile',
    description:
      'Comment calculer un prix qui tient : temps réel par prestation, frais de déplacement, charges et cotisations. Avec une grille indicative et les erreurs qui plombent une marge.',
    publishedAt: '2026-08-26',
    updatedAt: '2026-09-20',
    readingMinutes: 9,
  },
  {
    slug: 'devenir-laveur-auto-mobile',
    title: 'Devenir laveur auto mobile : par où commencer',
    description:
      'Statut, assurance, matériel, réglementation sur l’eau, budget de départ : les étapes concrètes pour lancer une activité de lavage auto à domicile sans se tromper.',
    publishedAt: '2026-08-26',
    updatedAt: '2026-09-20',
    readingMinutes: 11,
  },
  {
    slug: 'organiser-ses-tournees-lavage-auto',
    title: 'Organiser ses tournées pour laver plus de voitures par jour',
    description:
      'Les trajets entre deux rendez-vous mangent une à deux prestations par jour. Comment grouper ses créneaux par secteur, prévoir des durées réalistes et absorber les annulations.',
    publishedAt: '2026-08-26',
    updatedAt: '2026-09-20',
    readingMinutes: 8,
  },
]

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find(a => a.slug === slug)
}

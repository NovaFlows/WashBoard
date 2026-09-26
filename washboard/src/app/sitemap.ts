import type { MetadataRoute } from 'next'
import { ARTICLES, SITE_URL } from '@/lib/blog'
import { METIER_PAGES } from '@/lib/metiers'

// Liste des adresses du site, donnée à Google pour qu'il ne rate rien. Ce
// n'est pas un levier de classement : une adresse de plus ici ne fait pas
// monter une page, elle la rend seulement trouvable.
//
// `lastModified` n'est renseigné que là où une vraie date existe. Il valait
// `new Date()` sur l'accueil, /booking et /blog : la date était donc calculée
// à chaque passage du robot, qui trouvait une page « modifiée à l'instant »
// et pourtant identique, dix fois de suite. Un moteur qui constate ça cesse
// de faire confiance au champ — pour tout le site, y compris les articles qui
// portent une date honnête. Mieux vaut pas de date qu'une fausse.
const derniereMajBlog = ARTICLES
  .map(a => a.updatedAt)
  .sort()
  .at(-1)

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/booking`,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    // Pages métier ("logiciel pour <métier>") : notre contenu, aucune donnée
    // de laveur. Pas de `lastModified` pour la même raison que l'accueil —
    // une date recalculée à chaque passage du robot ment plus qu'elle n'aide.
    ...METIER_PAGES.map(m => ({
      url: `${SITE_URL}/${m.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    {
      url: `${SITE_URL}/blog`,
      // La date du dernier article publié : la page de liste change quand un
      // article change, pas à chaque requête.
      ...(derniereMajBlog ? { lastModified: new Date(derniereMajBlog) } : {}),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    ...ARTICLES.map(a => ({
      url: `${SITE_URL}/blog/${a.slug}`,
      lastModified: new Date(a.updatedAt),
      changeFrequency: 'yearly' as const,
      priority: 0.6,
    })),
    // Pages légales : aucun trafic à en attendre, mais ce sont des pages de
    // confiance qu'un moteur s'attend à trouver sur un site qui vend un
    // abonnement. Elles existaient sans être listées.
    ...['/mentions-legales', '/cgv', '/confidentialite'].map(chemin => ({
      url: `${SITE_URL}${chemin}`,
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    })),
  ]
}

import type { MetadataRoute } from 'next'
import { ARTICLES, SITE_URL } from '@/lib/blog'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/booking`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/blog`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    // Généré depuis l'index des articles : publier un article suffit à le
    // référencer, sans risque d'oublier de mettre le sitemap à jour.
    ...ARTICLES.map(a => ({
      url: `${SITE_URL}/blog/${a.slug}`,
      lastModified: new Date(a.updatedAt),
      changeFrequency: 'yearly' as const,
      priority: 0.6,
    })),
  ]
}

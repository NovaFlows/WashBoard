import type { Metadata } from 'next'

export const OG_SIZE = { width: 1200, height: 630 }
export const OG_CONTENT_TYPE = 'image/png'

type Images = NonNullable<NonNullable<Metadata['openGraph']>['images']>

/**
 * Balises d'image de partage d'une page du site public (app/vitrine/[langue]). Son image reste
 * générée à l'adresse publique (`app/blog/…/opengraph-image.tsx`), hors de l'arbre pré-calculé :
 * Next ne la rattache donc plus tout seul, la page la déclare ici (Open Graph et Twitter).
 * `chemin` : adresse publique de la page (`/blog/mon-article`, `/` pour l'image générale).
 */
export function imagePartage(chemin: string, alt: string): Images {
  const url = chemin === '/' ? '/opengraph-image' : `${chemin}/opengraph-image`
  return [{ url, width: OG_SIZE.width, height: OG_SIZE.height, type: OG_CONTENT_TYPE, alt }]
}

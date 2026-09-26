// Pages « métier » : une page de contenu par métier ciblé par WashBoard
// ("logiciel pour <métier>"), distincte de la landing (générique, un seul
// visiteur type par section) et du blog (conseils, un article par question).
// Aucune donnée de laveur n'y figure : uniquement du contenu WashBoard, et un
// maillage automatique vers les articles du même thème (voir `@/lib/blog`).
//
// Une page n'existe ici qu'une fois écrite — jamais avant. La section
// "Pour qui ?" de la landing (METIERS, dans LandingPage.tsx) ne fait un lien
// vers une page métier que si son thème apparaît dans cette liste : ajouter
// une entrée suffit à faire apparaître le lien, sans toucher à la landing.

import type { Theme } from '@/lib/blog'

export type MetierPageMeta = {
  /** Thème `blog.ts` associé : sert à retrouver automatiquement les articles
   *  à lister sur la page, sans liste écrite à la main qui se périmerait au
   *  prochain article publié. */
  theme: Theme
  /** Chemin de la page, sans barre de tête ni domaine ("logiciel-lavage-auto"). */
  slug: string
}

// Une entrée par page métier publiée. Les cinq autres métiers de la landing
// (vitres, textiles, ménage, piscine) et le sixième thème du blog (extérieur)
// rejoindront cette liste au fur et à mesure, chacun avec sa page écrite à la
// main — jamais générée automatiquement, le fond avant la technique.
export const METIER_PAGES: MetierPageMeta[] = [
  { theme: 'auto', slug: 'logiciel-lavage-auto' },
]

/** Page métier déjà publiée pour ce thème, s'il y en a une. */
export function metierPageForTheme(theme: Theme): MetierPageMeta | undefined {
  return METIER_PAGES.find(m => m.theme === theme)
}

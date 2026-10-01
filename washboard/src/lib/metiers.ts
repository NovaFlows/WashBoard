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
  /** Ce que la page couvre, tel qu'un lien qui y mène le dit : « Voir tout
   *  ce que WashBoard fait pour <cible> ». Rangé à côté du chemin pour que le
   *  texte d'un lien change en même temps que sa destination. */
  cible: string
}

// Une entrée par page métier publiée. Les trois autres métiers de la landing
// (vitres, ménage, piscine) et le sixième thème du blog (extérieur)
// rejoindront cette liste au fur et à mesure, chacun avec sa page écrite à la
// main — jamais générée automatiquement, le fond avant la technique.
export const METIER_PAGES: MetierPageMeta[] = [
  { theme: 'auto', slug: 'logiciel-lavage-auto', cible: 'le lavage auto' },
  { theme: 'textiles', slug: 'logiciel-nettoyage-canape', cible: 'le nettoyage de canapés à domicile' },
]

/** Page catégorie : la destination des thèmes qui n'ont pas encore leur page
 *  métier. Ce n'est pas une page métier, elle n'entre donc pas dans
 *  METIER_PAGES (qui piloterait sinon un lien depuis les cartes de la
 *  landing). */
export const HUB = { slug: 'logiciel-services-a-domicile', cible: 'les prestataires à domicile' } as const

/** Page métier déjà publiée pour ce thème, s'il y en a une. */
export function metierPageForTheme(theme: Theme): MetierPageMeta | undefined {
  return METIER_PAGES.find(m => m.theme === theme)
}

/** Lien vers la page qui parle le mieux d'un thème : sa page métier si elle
 *  est publiée, la page catégorie sinon. Sert au bas de chaque article du
 *  blog.
 *
 *  Adresse et texte viennent de la même entrée. Écrits séparément, l'adresse
 *  suivait le thème toute seule mais pas le texte : le jour où une page
 *  vitres sortait, l'article vitres y menait avec un lien annonçant encore
 *  « les prestataires à domicile » — et pour un moteur, le texte d'un lien
 *  décrit la page visée. */
export function lienPageMetier(theme: Theme): { href: string; label: string } {
  const page = metierPageForTheme(theme) ?? HUB
  return { href: `/${page.slug}`, label: `Voir tout ce que WashBoard fait pour ${page.cible}` }
}

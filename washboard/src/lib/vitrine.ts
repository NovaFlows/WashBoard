// Pages du site public pré-calculées (app/vitrine/[langue]) : src/proxy.ts les réécrit vers la
// version de la langue du visiteur. Une nouvelle page publique hors /blog = une ligne ici ET dans
// le `matcher` de src/proxy.ts (vitrine.test.ts vérifie les deux).

/** Adresses publiques (hors /blog/…) servies par app/vitrine/[langue]. */
export const PAGES_VITRINE = [
  '/',
  '/blog',
  '/cgv',
  '/confidentialite',
  '/mentions-legales',
  '/logiciel-lavage-auto',
  '/logiciel-nettoyage-canape',
  '/logiciel-services-a-domicile',
  '/meilleur-logiciel-lavage-auto',
  '/facturation-laveur-auto',
  '/optimisation-tournee-lavage-auto',
] as const

/** Dossier interne du site public, jamais visible de l'extérieur. */
export const PREFIXE_INTERNE = '/vitrine'

/** L'adresse demandée est-elle une page du site public ? Les images de partage restent à leur adresse. */
export function estPageVitrine(chemin: string): boolean {
  if (chemin.endsWith('/opengraph-image')) return false
  if ((PAGES_VITRINE as readonly string[]).includes(chemin)) return true
  return chemin.startsWith('/blog/')
}

/** Adresse interne de la version pré-calculée : `/blog` en anglais → `/vitrine/en/blog`. */
export function cheminInterne(chemin: string, langue: string): string {
  return `${PREFIXE_INTERNE}/${langue}${chemin === '/' ? '' : chemin}`
}

/** Accès direct au dossier interne : servi comme une adresse inconnue (404), jamais indexable. */
export function estCheminInterne(chemin: string): boolean {
  return chemin === PREFIXE_INTERNE || chemin.startsWith(PREFIXE_INTERNE + '/')
}

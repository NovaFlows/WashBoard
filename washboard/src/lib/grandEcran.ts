// Détection « grand écran » — refonte 2026, passe bureau (Alexandre, 2026-10-03). Sert à
// deux décisions différentes, qui restent volontairement un seul et même seuil :
//   1. le SITE (navigateur, pas la PWA) a-t-il le droit de voir la présentation v2 du tableau
//      de bord ? (voir `useDashboardV2.ts` — toujours combiné à `washers.beta_refonte`, lui
//      temporaire, le temps que les autres écrans suivent)
//   2. une fois en v2, la liste Clients a-t-elle la place de montrer la fiche À CÔTÉ plutôt
//      que PAR-DESSUS (voir ClientsViewV2.tsx) ?
//
// Seuil posé au palier `lg` de Tailwind (1024px), pas `sm`/`md` : un iPhone Pro Max tenu à
// l'horizontale fait ≈926px de large (CSS), et la PWA installée sur téléphone doit rester
// inchangée QUELLE QUE SOIT son orientation (décision du 2026-09-22, toujours en vigueur) — un
// seuil à 768px l'aurait fait basculer par erreur en paysage. 1024px laisse une marge franche
// au-dessus du plus grand téléphone courant, sans redescendre vers la zone des tablettes en
// portrait où un panneau fixe à côté de la liste serait de toute façon trop à l'étroit pour un
// doigt (voir le commentaire plus long dans ClientProfileModalV2.tsx sur ce point).
export const SEUIL_GRAND_ECRAN_PX = 1024

const REQUETE_GRAND_ECRAN = `(min-width: ${SEUIL_GRAND_ECRAN_PX}px)`

/** Fonction pure, sans état — même rôle que `isPwaStandalone()` : à consommer via le hook
 *  `useGrandEcran()` (hooks/), jamais appelée directement dans un composant React. */
export function estGrandEcran(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.matchMedia(REQUETE_GRAND_ECRAN).matches
  } catch {
    return false
  }
}

/** Abonnement pour `useSyncExternalStore` — contrairement à `display-mode: standalone`
 *  (qui ne change jamais en cours de session), la largeur de la fenêtre change tout le temps
 *  sur ordinateur (redimensionner, diviser l'écran) : il faut une vraie notification, pas un
 *  no-op comme `usePwaStandalone.ts`. */
export function sAbonnerGrandEcran(notifier: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const mql = window.matchMedia(REQUETE_GRAND_ECRAN)
  mql.addEventListener('change', notifier)
  return () => mql.removeEventListener('change', notifier)
}

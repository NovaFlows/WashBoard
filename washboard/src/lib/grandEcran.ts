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

// ── Seuil du RAIL, distinct de celui du panneau à deux colonnes ────────────────
//
// Posé le 2026-10-05 : Alexandre ne voyait jamais le rail, sa fenêtre étant sous les 1024px
// (l'agrandissement d'affichage de Windows y est pour beaucoup : à 150 %, un écran de 1366px
// n'en annonce que 910 au navigateur). Il veut qu'il apparaisse.
//
// On ne peut pas simplement baisser SEUIL_GRAND_ECRAN_PX : un grand téléphone tenu à
// l'horizontale fait ≈926px, et la PWA sur téléphone doit garder sa barre du bas quelle que
// soit l'orientation. D'où un second critère, qui sépare vraiment les deux mondes : la
// présence d'une souris ou d'un pavé tactile. `any-pointer: fine` est vrai dès qu'un pointeur
// précis existe — vrai sur un ordinateur portable même tactile, faux sur un téléphone, qui n'en
// a aucun. La largeur seule ne sait pas faire cette différence.
//
// Le panneau à deux colonnes de Clients, lui, garde SEUIL_GRAND_ECRAN_PX (1024) : c'est une
// vraie question de place (252 de rail + 380 de liste + la fiche), pas de type d'appareil.
export const SEUIL_RAIL_PX = 880

const REQUETE_RAIL = `(min-width: ${SEUIL_RAIL_PX}px) and (any-pointer: fine)`

/** Fonction pure — à consommer via `useEcranRail()`. */
export function estEcranRail(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.matchMedia(REQUETE_RAIL).matches
  } catch {
    return false
  }
}

export function sAbonnerEcranRail(notifier: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const mql = window.matchMedia(REQUETE_RAIL)
  mql.addEventListener('change', notifier)
  return () => mql.removeEventListener('change', notifier)
}

// ── Seuil du côte-à-côte réglages/aperçu d'« Apparence de ma page », distinct des deux
// précédents ──────────────────────────────────────────────────────────────────────────
//
// Posé le 2026-10-07 (retouche de mise en page, `ApparenceV2.tsx`) : `useGrandEcran()` (1024px)
// répond à « le rail et la colonne "Plus" ont-ils la place ? », pas à « ENCORE une rangée de
// deux colonnes, à l'intérieur de cette colonne, a-t-elle la place ? ». Mesuré en capturant
// cette passe : à 1024px de fenêtre, il ne reste que ~410px une fois le rail (252px) et la
// colonne « Plus » (260px) retirés — une colonne de réglages à côté d'un aperçu de 512px n'y
// tient pas. 1280px laisse ~630px, assez pour une colonne de réglages de ~300px ET un aperçu
// proche de sa largeur naturelle sans que l'un mange l'autre.
export const SEUIL_APPARENCE_COTE_A_COTE_PX = 1280

const REQUETE_APPARENCE_COTE_A_COTE = `(min-width: ${SEUIL_APPARENCE_COTE_A_COTE_PX}px)`

/** Fonction pure — à consommer via `useApparenceCoteACote()`. */
export function estApparenceCoteACote(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.matchMedia(REQUETE_APPARENCE_COTE_A_COTE).matches
  } catch {
    return false
  }
}

export function sAbonnerApparenceCoteACote(notifier: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const mql = window.matchMedia(REQUETE_APPARENCE_COTE_A_COTE)
  mql.addEventListener('change', notifier)
  return () => mql.removeEventListener('change', notifier)
}

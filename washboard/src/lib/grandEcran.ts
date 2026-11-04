import { REQUETE_ECRAN_MOBILE } from '@/lib/designMobile'

// Présentation du tableau de bord (Alexandre, 2026-11-02) : téléphone → mobile (barre du bas),
// tout le reste (ordinateur, tablette, fenêtre réduite) → ordinateur (rail). Plus d'ancien écran.
// Le rail est donc exactement « pas un téléphone », au sens de `REQUETE_ECRAN_MOBILE`.
//
// Le « grand écran » (mises en page à deux colonnes : Agenda Semaine/Mois, fiche client à côté de
// la liste…) demande en plus la place : rail ET au moins 880px. Entre 768 et 879px (iPad en
// portrait), rail réduit à ses icônes et écrans sur une colonne.
export const SEUIL_GRAND_ECRAN_PX = 880

const REQUETE_LARGEUR_GRAND_ECRAN = `(min-width: ${SEUIL_GRAND_ECRAN_PX}px)`

/** Fonction pure — à consommer via `useEcranRail()`. */
export function estEcranRail(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return !window.matchMedia(REQUETE_ECRAN_MOBILE).matches
  } catch {
    return false
  }
}

export function sAbonnerEcranRail(notifier: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const mql = window.matchMedia(REQUETE_ECRAN_MOBILE)
  mql.addEventListener('change', notifier)
  return () => mql.removeEventListener('change', notifier)
}

/** Fonction pure — à consommer via `useGrandEcran()`. */
export function estGrandEcran(): boolean {
  if (!estEcranRail()) return false
  try {
    return window.matchMedia(REQUETE_LARGEUR_GRAND_ECRAN).matches
  } catch {
    return false
  }
}

export function sAbonnerGrandEcran(notifier: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const mqls = [window.matchMedia(REQUETE_ECRAN_MOBILE), window.matchMedia(REQUETE_LARGEUR_GRAND_ECRAN)]
  mqls.forEach(m => m.addEventListener('change', notifier))
  return () => mqls.forEach(m => m.removeEventListener('change', notifier))
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

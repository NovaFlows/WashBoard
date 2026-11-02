'use client'

/** Nouvelle version partout depuis le 2026-11-02 (téléphone → mobile, le reste → ordinateur,
 *  voir grandEcran.ts). Vrai dès le rendu serveur. Retiré avec les derniers écrans V1. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature conservée pour les appelants
export function useDashboardV2(betaRefonte?: boolean | null): boolean {
  return true
}

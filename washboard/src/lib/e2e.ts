// Ce qui distingue les tests de bout en bout (Playwright, dossier `e2e/`) du site en ligne.
//
// Les tests écrivent dans la vraie base, sur le compte de l'équipe, et préfixent tout ce
// qu'ils créent par `[E2E]`. Ils tournent sur un serveur lancé pour eux : `next dev` en
// local, ou le build de production de la CI avec `E2E_CLEANUP_ENABLED=true` — variable qui
// n'existe QUE dans le workflow GitHub Actions et ne doit jamais être posée sur Vercel.

export const PREFIXE_E2E = '[E2E]'

/** Le serveur tourne pour les tests (dev local, ou CI qui teste un build de production). */
export function serveurDeTest(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.E2E_CLEANUP_ENABLED === 'true'
}

/** Réservation créée par un test : on ne prévient personne (demande d'Alexandre,
 *  2026-10-18 — chaque exécution lui envoyait emails et notifications de « nouvelle
 *  réservation » sur le compte de l'équipe). En ligne, toujours `false`. */
export function estReservationDeTest(nomClient: string | null | undefined): boolean {
  return serveurDeTest() && (nomClient ?? '').trim().startsWith(PREFIXE_E2E)
}

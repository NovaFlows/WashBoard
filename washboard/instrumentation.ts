import * as Sentry from '@sentry/nextjs'

// Point d'entrée officiel Next pour enregistrer un SDK d'observabilité, selon
// le runtime qui exécute le code (Node pour les routes normales, Edge pour un
// éventuel middleware — WashBoard n'en a pas aujourd'hui, voir
// sentry.edge.config.ts).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('./sentry.server.config')
  if (process.env.NEXT_RUNTIME === 'edge') await import('./sentry.edge.config')
}

// Capture les erreurs que Next intercepte lui-même pendant le rendu serveur
// ou la récupération de données, avant qu'elles n'atteignent un `try/catch`
// applicatif — donc avant tout appel à `logger.error` (voir src/lib/logger.ts
// pour le reste de la couverture).
export const onRequestError = Sentry.captureRequestError

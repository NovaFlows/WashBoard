import * as Sentry from '@sentry/nextjs'

// Éteint tant que NEXT_PUBLIC_SENTRY_DSN n'est pas renseignée (voir
// .env.example) : aucun compte Sentry n'existe encore pour la plupart des
// laveurs qui font tourner ce code en local, il ne doit rien se passer.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    // Alertes d'erreur uniquement pour l'instant, pas de suivi de
    // performance : évite de consommer le quota gratuit pour une donnée
    // qui n'a pas été demandée.
    tracesSampleRate: 0,
  })
}

import * as Sentry from '@sentry/nextjs'

// Même garde que côté serveur (voir sentry.server.config.ts) : rien ne se
// passe pour un laveur qui n'a pas configuré Sentry.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0,
  })
}

// Requis par Next pour suivre les erreurs de navigation côté client.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart

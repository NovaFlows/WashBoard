import * as Sentry from '@sentry/nextjs'

// Aucune route Edge ni middleware aujourd'hui dans WashBoard : ce fichier ne
// sert donc à rien pour l'instant, mais Next l'appelle s'il existe et son
// absence ferait échouer l'import conditionnel dans instrumentation.ts si un
// jour une route bascule sur ce runtime. Même garde par variable d'env que
// sentry.server.config.ts.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0,
  })
}

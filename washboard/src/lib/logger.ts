import * as Sentry from '@sentry/nextjs'

// Logger structuré (JSON une ligne). Vercel capture stdout/stderr → les logs
// sont recherchables/filtrables par `event`, `level`, `errorId`, etc.
//
// Objectif prod : quand quelque chose casse, on retrouve l'incident en secondes
// (grep dans les logs Vercel) grâce à un format cohérent et à des identifiants.
//
// `logger.error` relaie aussi vers Sentry (alerte + stack trace), tant que
// NEXT_PUBLIC_SENTRY_DSN est configurée — voir sentry.server.config.ts. Un
// seul point d'accroche plutôt qu'un appel Sentry ajouté dans chaque route :
// tout ce qui passe déjà par `logger.error` (AppError 5xx via apiError.ts,
// error boundaries React, échecs de lecture...) devient une alerte sans
// toucher ces dizaines d'appels existants. `logger.warn` (4xx attendus,
// pannes tolérées avec repli) n'y remonte pas : ce ne sont pas des pannes.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type LogContext = Record<string, unknown>

export type LogEntry = {
  ts: string
  level: LogLevel
  event: string
  context?: LogContext
  error?: { name: string; message: string; stack?: string }
}

/** Sérialise n'importe quelle valeur d'erreur en objet loggable (pure, testable). */
export function serializeError(err: unknown): LogEntry['error'] | undefined {
  if (err == null) return undefined
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack }
  }
  return { name: 'NonError', message: typeof err === 'string' ? err : JSON.stringify(err) }
}

/** Construit l'entrée de log structurée (pure, testable — pas d'I/O). */
export function buildLogEntry(
  level: LogLevel,
  event: string,
  context?: LogContext,
  err?: unknown,
  now: Date = new Date(),
): LogEntry {
  const entry: LogEntry = { ts: now.toISOString(), level, event }
  if (context && Object.keys(context).length > 0) entry.context = context
  const serialized = serializeError(err)
  if (serialized) entry.error = serialized
  return entry
}

function emit(level: LogLevel, event: string, context?: LogContext, err?: unknown): void {
  const entry = buildLogEntry(level, event, context, err)
  const line = JSON.stringify(entry)
  // warn/error → stderr ; debug/info → stdout. Les deux sont captés par Vercel.
  if (level === 'error' || level === 'warn') console.error(line)
  else console.log(line)

  if (level === 'error' && process.env.NEXT_PUBLIC_SENTRY_DSN) {
    if (err instanceof Error) Sentry.captureException(err, { extra: { event, ...context } })
    else Sentry.captureMessage(event, { level: 'error', extra: context })
  }
}

export const logger = {
  debug: (event: string, context?: LogContext) => emit('debug', event, context),
  info:  (event: string, context?: LogContext) => emit('info', event, context),
  warn:  (event: string, context?: LogContext, err?: unknown) => emit('warn', event, context, err),
  error: (event: string, context?: LogContext, err?: unknown) => emit('error', event, context, err),
}

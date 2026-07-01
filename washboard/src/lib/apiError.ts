import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { logger, type LogContext } from './logger'

// Gestion d'erreur API homogène + traçable.
//
// Principe : toute erreur non gérée d'une route renvoie au client un `errorId`
// unique, et le MÊME id est loggé côté serveur avec la stack. En prod, le client
// donne l'errorId → on le grep dans les logs Vercel → on a le contexte complet.
// On n'expose jamais le détail interne au client (message générique).

/** Erreur "métier" volontaire, avec un statut et un message public sûr à afficher. */
export class AppError extends Error {
  status: number
  publicMessage: string
  code?: string
  constructor(message: string, opts?: { status?: number; publicMessage?: string; code?: string }) {
    super(message)
    this.name = 'AppError'
    this.status = opts?.status ?? 400
    this.publicMessage = opts?.publicMessage ?? message
    this.code = opts?.code
  }
}

/** Détermine statut + message public d'une erreur (pure, testable). */
export function resolveError(err: unknown): { status: number; publicMessage: string; code?: string } {
  if (err instanceof AppError) {
    return { status: err.status, publicMessage: err.publicMessage, code: err.code }
  }
  // Erreur inattendue : on ne fuite rien au client.
  return { status: 500, publicMessage: 'Une erreur interne est survenue.' }
}

/** Loggue l'erreur avec un errorId et renvoie une réponse JSON homogène. */
export function errorResponse(event: string, err: unknown, context?: LogContext): NextResponse {
  const errorId = randomUUID()
  const { status, publicMessage, code } = resolveError(err)
  // 4xx = attendu (warn), 5xx = anormal (error) → niveaux distincts pour le tri.
  const level = status >= 500 ? 'error' : 'warn'
  logger[level](event, { ...context, errorId, status, code }, err)
  return NextResponse.json({ error: publicMessage, errorId }, { status })
}

/** Enveloppe un handler de route : capture toute exception → réponse traçable.
 *  Usage : `export const POST = withErrorHandling('stripe.checkout', async (req) => {...})`
 */
export function withErrorHandling<T extends unknown[]>(
  event: string,
  handler: (...args: T) => Promise<Response>,
): (...args: T) => Promise<Response> {
  return async (...args: T) => {
    try {
      return await handler(...args)
    } catch (err) {
      return errorResponse(event, err)
    }
  }
}

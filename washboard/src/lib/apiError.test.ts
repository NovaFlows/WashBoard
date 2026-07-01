import { describe, it, expect, vi, afterEach } from 'vitest'
import { AppError, resolveError, errorResponse, withErrorHandling } from './apiError'

afterEach(() => vi.restoreAllMocks())

describe('AppError', () => {
  it('valeurs par défaut (status 400, message public = message)', () => {
    const e = new AppError('Plan invalide')
    expect(e.status).toBe(400)
    expect(e.publicMessage).toBe('Plan invalide')
    expect(e.name).toBe('AppError')
  })
  it('options personnalisées', () => {
    const e = new AppError('interne', { status: 409, publicMessage: 'Déjà abonné', code: 'DUP' })
    expect(e.status).toBe(409)
    expect(e.publicMessage).toBe('Déjà abonné')
    expect(e.code).toBe('DUP')
  })
})

describe('resolveError', () => {
  it('AppError → son statut et son message public', () => {
    expect(resolveError(new AppError('x', { status: 404, publicMessage: 'Introuvable' })))
      .toEqual({ status: 404, publicMessage: 'Introuvable', code: undefined })
  })
  it('erreur inattendue → 500 générique (pas de fuite)', () => {
    const r = resolveError(new Error('SELECT * secret detail'))
    expect(r.status).toBe(500)
    expect(r.publicMessage).toBe('Une erreur interne est survenue.')
  })
})

describe('errorResponse', () => {
  it('renvoie un errorId + logge le même id', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = errorResponse('stripe.webhook', new Error('db down'), { eventId: 'evt_1' })
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Une erreur interne est survenue.')
    expect(body.errorId).toMatch(/[0-9a-f-]{36}/)
    // le log contient le même errorId
    const logged = JSON.parse(spy.mock.calls[0][0] as string)
    expect(logged.context.errorId).toBe(body.errorId)
    expect(logged.context.eventId).toBe('evt_1')
  })

  it('4xx → niveau warn (console.error mais level warn)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = errorResponse('x', new AppError('Interdit', { status: 403 }))
    expect(res.status).toBe(403)
    const logged = JSON.parse(spy.mock.calls[0][0] as string)
    expect(logged.level).toBe('warn')
  })
})

describe('withErrorHandling', () => {
  it('laisse passer la réponse en cas de succès', async () => {
    const handler = withErrorHandling('ok', async () => new Response('ok', { status: 200 }))
    const res = await handler()
    expect(res.status).toBe(200)
  })

  it('capture une exception → réponse 500 traçable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const handler = withErrorHandling('boom', async () => { throw new Error('kaboom') })
    const res = await handler()
    expect(res.status).toBe(500)
    const body = await (res as Response).json()
    expect(body.errorId).toBeTruthy()
  })

  it('propage le statut d’une AppError', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const handler = withErrorHandling('dup', async () => {
      throw new AppError('déjà là', { status: 409, publicMessage: 'Déjà abonné' })
    })
    const res = await handler()
    expect(res.status).toBe(409)
    const body = await (res as Response).json()
    expect(body.error).toBe('Déjà abonné')
  })
})

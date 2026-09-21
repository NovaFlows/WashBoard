import { describe, it, expect, vi, afterEach } from 'vitest'

const { captureException, captureMessage } = vi.hoisted(() => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))
vi.mock('@sentry/nextjs', () => ({ captureException, captureMessage }))

import { serializeError, buildLogEntry, logger } from './logger'

describe('serializeError', () => {
  it('sérialise une Error avec name/message/stack', () => {
    const s = serializeError(new TypeError('boom'))
    expect(s?.name).toBe('TypeError')
    expect(s?.message).toBe('boom')
    expect(s?.stack).toContain('boom')
  })
  it('gère une string', () => {
    expect(serializeError('oops')).toEqual({ name: 'NonError', message: 'oops' })
  })
  it('gère un objet non-Error', () => {
    expect(serializeError({ code: 42 })).toEqual({ name: 'NonError', message: '{"code":42}' })
  })
  it('null/undefined → undefined', () => {
    expect(serializeError(null)).toBeUndefined()
    expect(serializeError(undefined)).toBeUndefined()
  })
})

describe('buildLogEntry', () => {
  const now = new Date('2026-07-02T12:00:00Z')

  it('structure de base : ts, level, event', () => {
    const e = buildLogEntry('info', 'test.event', undefined, undefined, now)
    expect(e).toEqual({ ts: '2026-07-02T12:00:00.000Z', level: 'info', event: 'test.event' })
  })
  it('inclut le contexte non vide', () => {
    const e = buildLogEntry('warn', 'x', { userId: 'u1' }, undefined, now)
    expect(e.context).toEqual({ userId: 'u1' })
  })
  it('ignore un contexte vide', () => {
    const e = buildLogEntry('info', 'x', {}, undefined, now)
    expect(e.context).toBeUndefined()
  })
  it('inclut l’erreur sérialisée', () => {
    const e = buildLogEntry('error', 'x', undefined, new Error('bad'), now)
    expect(e.error?.message).toBe('bad')
  })
})

describe('logger (émission)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('info/debug → console.log avec du JSON valide', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    logger.info('booking.created', { id: 'b1' })
    expect(spy).toHaveBeenCalledOnce()
    const parsed = JSON.parse(spy.mock.calls[0][0] as string)
    expect(parsed).toMatchObject({ level: 'info', event: 'booking.created', context: { id: 'b1' } })
  })

  it('warn/error → console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logger.error('stripe.webhook.failed', { eventId: 'evt_1' }, new Error('db down'))
    const parsed = JSON.parse(spy.mock.calls[0][0] as string)
    expect(parsed.level).toBe('error')
    expect(parsed.error.message).toBe('db down')
  })

  it('debug et warn émettent aussi', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logger.debug('d')
    logger.warn('w')
    expect(logSpy).toHaveBeenCalledOnce()
    expect(errSpy).toHaveBeenCalledOnce()
  })
})

describe('logger → Sentry', () => {
  const DSN = 'https://exemple@o0.ingest.sentry.io/1'
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    captureException.mockClear()
    captureMessage.mockClear()
  })

  it('sans DSN configurée, aucun appel à Sentry', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    logger.error('x', undefined, new Error('boom'))
    expect(captureException).not.toHaveBeenCalled()
    expect(captureMessage).not.toHaveBeenCalled()
  })

  it('avec DSN et une Error, relaie via captureException', () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', DSN)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const err = new Error('db down')
    logger.error('stripe.webhook.failed', { eventId: 'evt_1' }, err)
    expect(captureException).toHaveBeenCalledWith(err, { extra: { event: 'stripe.webhook.failed', eventId: 'evt_1' } })
    expect(captureMessage).not.toHaveBeenCalled()
  })

  it('avec DSN et sans Error, relaie via captureMessage', () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', DSN)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    logger.error('account.not_found', { userId: 'u1' })
    expect(captureMessage).toHaveBeenCalledWith('account.not_found', { level: 'error', extra: { userId: 'u1' } })
    expect(captureException).not.toHaveBeenCalled()
  })

  it('avec DSN, un warn ne relaie pas vers Sentry (pas une panne)', () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', DSN)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    logger.warn('x', undefined, new Error('attendu'))
    expect(captureException).not.toHaveBeenCalled()
    expect(captureMessage).not.toHaveBeenCalled()
  })
})

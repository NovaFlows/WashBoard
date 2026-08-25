import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'
import { isAuthorizedCron, parseTestMode } from './cronRequest'

function req(url: string, auth?: string): NextRequest {
  return {
    nextUrl: new URL(url),
    headers: { get: (k: string) => (k.toLowerCase() === 'authorization' ? auth ?? null : null) },
  } as unknown as NextRequest
}

describe('isAuthorizedCron', () => {
  beforeEach(() => vi.stubEnv('CRON_SECRET', 's3cret'))

  it('accepte le bon bearer', () => {
    expect(isAuthorizedCron(req('https://x/api/cron/a', 'Bearer s3cret'))).toBe(true)
  })
  it('refuse un mauvais bearer ou une absence d’en-tête', () => {
    expect(isAuthorizedCron(req('https://x/api/cron/a', 'Bearer nope'))).toBe(false)
    expect(isAuthorizedCron(req('https://x/api/cron/a'))).toBe(false)
  })
  it('refuse tout si CRON_SECRET n’est pas configuré', () => {
    vi.stubEnv('CRON_SECRET', '')
    expect(isAuthorizedCron(req('https://x/api/cron/a', 'Bearer '))).toBe(false)
  })
})

describe('parseTestMode', () => {
  it('est désactivé par défaut', () => {
    expect(parseTestMode(req('https://x/api/cron/a'))).toEqual({ enabled: false })
  })
  it('exige un laveur pour éviter un envoi de masse', () => {
    expect(parseTestMode(req('https://x/api/cron/a?test=1'))).toHaveProperty('error')
  })
  it('cible un seul laveur quand il est fourni', () => {
    expect(parseTestMode(req('https://x/api/cron/a?test=1&washer=abc')))
      .toEqual({ enabled: true, washerId: 'abc' })
  })
  it('ignore une valeur de test autre que 1', () => {
    expect(parseTestMode(req('https://x/api/cron/a?test=true&washer=abc')))
      .toEqual({ enabled: false })
  })
})

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { rateLimit } from './rateLimit'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('rateLimit', () => {
  it('autorise jusqu’à la limite puis bloque', () => {
    const key = 'test:within'
    // limite 3 / fenêtre 1000ms
    expect(rateLimit(key, 3, 1000).ok).toBe(true)
    expect(rateLimit(key, 3, 1000).ok).toBe(true)
    expect(rateLimit(key, 3, 1000).ok).toBe(true)
    const blocked = rateLimit(key, 3, 1000)
    expect(blocked.ok).toBe(false)
    expect(blocked.retryAfter).toBeGreaterThan(0)
  })

  it('compte les clés indépendamment', () => {
    expect(rateLimit('ipA', 1, 1000).ok).toBe(true)
    expect(rateLimit('ipA', 1, 1000).ok).toBe(false) // A bloqué
    expect(rateLimit('ipB', 1, 1000).ok).toBe(true)  // B indépendant
  })

  it('réautorise après expiration de la fenêtre', () => {
    const key = 'test:window'
    expect(rateLimit(key, 1, 1000).ok).toBe(true)
    expect(rateLimit(key, 1, 1000).ok).toBe(false)
    // on avance au-delà de la fenêtre
    vi.advanceTimersByTime(1001)
    expect(rateLimit(key, 1, 1000).ok).toBe(true)
  })
})

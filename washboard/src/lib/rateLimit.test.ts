import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { rateLimit, cleanupRateLimit, clientIp } from './rateLimit'

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

describe('cleanupRateLimit', () => {
  it('ne fait rien tant que le store est petit (< 1000 entrées)', () => {
    // quelques entrées seulement → pas de purge, aucune erreur
    rateLimit('cleanup:small', 5, 1000)
    expect(() => cleanupRateLimit()).not.toThrow()
    // l'entrée reste consultable (toujours dans la fenêtre)
    expect(rateLimit('cleanup:small', 5, 1000).ok).toBe(true)
  })

  it('purge les entrées expirées au-delà de 1000 clés', () => {
    // remplit > 1000 clés dont la fenêtre est déjà passée
    for (let i = 0; i < 1100; i++) rateLimit(`bulk:${i}`, 1, 1000)
    // on avance après expiration de toutes les fenêtres
    vi.advanceTimersByTime(2000)
    cleanupRateLimit()
    // après purge, une clé expirée repart de zéro (donc autorisée)
    expect(rateLimit('bulk:0', 1, 1000).ok).toBe(true)
  })
})

describe('clientIp', () => {
  const req = (entetes: Record<string, string>) => ({
    headers: { get: (n: string) => entetes[n] ?? null },
  })

  it('prend la première adresse de la chaîne de proxys', () => {
    // Vercel empile « client, proxy1, proxy2 » : seule la première est le visiteur.
    expect(clientIp(req({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1, 10.0.0.2' }))).toBe('203.0.113.7')
  })

  it('tolère les espaces autour de l\'adresse', () => {
    expect(clientIp(req({ 'x-forwarded-for': '  203.0.113.7  ' }))).toBe('203.0.113.7')
  })

  it('retombe sur x-real-ip', () => {
    expect(clientIp(req({ 'x-real-ip': '203.0.113.9' }))).toBe('203.0.113.9')
  })

  it('ignore un x-forwarded-for vide au profit de x-real-ip', () => {
    expect(clientIp(req({ 'x-forwarded-for': '', 'x-real-ip': '203.0.113.9' }))).toBe('203.0.113.9')
  })

  it('rend « unknown » quand aucun en-tête n\'est présent', () => {
    // Tous ces appels partagent alors le même compteur : c'est le comportement
    // prudent, mieux vaut trop limiter que pas du tout.
    expect(clientIp(req({}))).toBe('unknown')
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHmac } from 'crypto'

const comparaison = vi.hoisted(() => ({ appels: 0 }))
vi.mock('crypto', async importOriginal => {
  const vrai = await importOriginal<typeof import('crypto')>()
  const timingSafeEqual: typeof vrai.timingSafeEqual = (a, b) => { comparaison.appels++; return vrai.timingSafeEqual(a, b) }
  return { ...vrai, default: { ...vrai, timingSafeEqual }, timingSafeEqual }
})
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }))

const { genererJetonReservation, jetonValide } = await import('./bookingToken')
const { logger } = await import('@/lib/logger')

const ID = '6f1c2a4e-1b2c-4d5e-8f90-123456789abc'
const AUTRE_ID = '6f1c2a4e-1b2c-4d5e-8f90-123456789abd'

beforeEach(() => {
  vi.stubEnv('BOOKING_LINK_SECRET', 'cle-de-test-pas-un-vrai-secret')
  vi.mocked(logger.error).mockClear()
})
afterEach(() => { vi.unstubAllEnvs() })

describe('genererJetonReservation', () => {
  it('est un HMAC-SHA256 de l’id, en base64url', () => {
    const attendu = createHmac('sha256', 'cle-de-test-pas-un-vrai-secret').update(ID).digest('base64url')
    expect(genererJetonReservation(ID)).toBe(attendu)
    expect(genererJetonReservation(ID)).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it('n’est jamais l’id lui-même, ni celui d’une autre réservation', () => {
    const jeton = genererJetonReservation(ID)
    expect(jeton).not.toContain(ID)
    expect(jeton).not.toBe(genererJetonReservation(AUTRE_ID))
  })

  it('dépend de la clé : une autre clé donne un autre jeton', () => {
    const avant = genererJetonReservation(ID)
    vi.stubEnv('BOOKING_LINK_SECRET', 'une-autre-cle')
    expect(genererJetonReservation(ID)).not.toBe(avant)
  })

  it('sans clé, n’émet rien et le signale', () => {
    vi.stubEnv('BOOKING_LINK_SECRET', '')
    expect(genererJetonReservation(ID)).toBeNull()
    expect(logger.error).toHaveBeenCalledWith('bookings.jeton.secret_missing')
  })
})

describe('jetonValide', () => {
  it('accepte le jeton de cette réservation', () => {
    expect(jetonValide(ID, genererJetonReservation(ID))).toBe(true)
  })

  it('refuse le jeton d’une autre réservation', () => {
    expect(jetonValide(ID, genererJetonReservation(AUTRE_ID))).toBe(false)
  })

  it('refuse l’id seul, qui est justement ce que le laveur connaît', () => {
    expect(jetonValide(ID, ID)).toBe(false)
  })

  it('refuse un jeton absent ou vide', () => {
    expect(jetonValide(ID, null)).toBe(false)
    expect(jetonValide(ID, undefined)).toBe(false)
    expect(jetonValide(ID, '')).toBe(false)
  })

  it('refuse un jeton de bonne longueur à un caractère près, sans lever d’exception', () => {
    const jeton = genererJetonReservation(ID)!
    const altere = (jeton[0] === 'A' ? 'B' : 'A') + jeton.slice(1)
    expect(jetonValide(ID, altere)).toBe(false)
    expect(jetonValide(ID, jeton.slice(0, -1))).toBe(false)
    expect(jetonValide(ID, jeton + 'x')).toBe(false)
  })

  it('sans clé, refuse tout — même un jeton qui était valide', () => {
    const jeton = genererJetonReservation(ID)
    vi.stubEnv('BOOKING_LINK_SECRET', '')
    expect(jetonValide(ID, jeton)).toBe(false)
    expect(logger.error).toHaveBeenCalledWith('bookings.jeton.secret_missing')
  })

  it('compare en temps constant (timingSafeEqual), pas avec ===', () => {
    const jeton = genererJetonReservation(ID)!
    comparaison.appels = 0
    jetonValide(ID, jeton)
    jetonValide(ID, (jeton[0] === 'A' ? 'B' : 'A') + jeton.slice(1))
    expect(comparaison.appels).toBe(2)
  })
})

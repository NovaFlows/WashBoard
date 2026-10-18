import { describe, it, expect, vi, afterEach } from 'vitest'
import { estReservationDeTest, serveurDeTest } from './e2e'

afterEach(() => { vi.unstubAllEnvs() })

describe('réservations des tests de bout en bout', () => {
  it('en ligne, jamais : même un nom préfixé [E2E] reçoit ses notifications', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('E2E_CLEANUP_ENABLED', '')
    expect(serveurDeTest()).toBe(false)
    expect(estReservationDeTest('[E2E] Test Client')).toBe(false)
  })
  it('sur le serveur de la CI ou en local, seulement les noms préfixés [E2E]', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('E2E_CLEANUP_ENABLED', 'true')
    expect(estReservationDeTest('[E2E] Test Client')).toBe(true)
    expect(estReservationDeTest('Nadia Costa')).toBe(false)
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('E2E_CLEANUP_ENABLED', '')
    expect(estReservationDeTest('  [E2E] Annulation')).toBe(true)
    expect(estReservationDeTest(null)).toBe(false)
  })
})

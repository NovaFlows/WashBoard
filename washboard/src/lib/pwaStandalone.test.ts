import { describe, it, expect, afterEach } from 'vitest'
import { isPwaStandalone } from './pwaStandalone'

// Même précaution que `getOrCreateSessionId` (funnelTracking.test.ts) : dans
// cet environnement de test (`node`, sans DOM), `window` n'existe pas par
// défaut — on le pose et le retire à la main pour simuler les trois
// environnements réels (site, PWA Android/ordinateur, PWA iOS).
describe('isPwaStandalone', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window')

  afterEach(() => {
    if (original) Object.defineProperty(globalThis, 'window', original)
    else Reflect.deleteProperty(globalThis, 'window')
  })

  it('renvoie false hors navigateur (aucun window)', () => {
    expect(isPwaStandalone()).toBe(false)
  })

  it('renvoie false dans un navigateur classique (site, mobile ou ordinateur)', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        matchMedia: () => ({ matches: false }),
        navigator: {},
      },
    })
    expect(isPwaStandalone()).toBe(false)
  })

  it('renvoie true pour une PWA installée sur Android ou ordinateur (display-mode: standalone)', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        matchMedia: (q: string) => ({ matches: q === '(display-mode: standalone)' }),
        navigator: {},
      },
    })
    expect(isPwaStandalone()).toBe(true)
  })

  it('renvoie true pour une PWA installée sur iOS (navigator.standalone, display-mode absent)', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        matchMedia: () => ({ matches: false }),
        navigator: { standalone: true },
      },
    })
    expect(isPwaStandalone()).toBe(true)
  })

  it('renvoie false plutôt que de lever une exception si matchMedia échoue', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        matchMedia: () => { throw new Error('non supporté') },
        navigator: {},
      },
    })
    expect(() => isPwaStandalone()).not.toThrow()
    expect(isPwaStandalone()).toBe(false)
  })
})

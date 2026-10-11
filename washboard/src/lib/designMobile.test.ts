import { describe, it, expect, afterEach } from 'vitest'
import { isDesignMobile, REQUETE_ECRAN_MOBILE } from './designMobile'

function simuler(correspond: (q: string) => boolean, navigator: Record<string, unknown> = {}) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { matchMedia: (q: string) => ({ matches: correspond(q) }), navigator },
  })
}

describe('isDesignMobile', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window')
  afterEach(() => {
    if (original) Object.defineProperty(globalThis, 'window', original)
    else Reflect.deleteProperty(globalThis, 'window')
  })

  it('design ordinateur côté serveur', () => {
    expect(isDesignMobile()).toBe(false)
  })

  it('design ordinateur dans un navigateur large', () => {
    simuler(() => false)
    expect(isDesignMobile()).toBe(false)
  })

  it('design mobile pour un téléphone dans son navigateur', () => {
    simuler(q => q === REQUETE_ECRAN_MOBILE)
    expect(isDesignMobile()).toBe(true)
  })

  it('design mobile pour l’application installée, même sur grand écran', () => {
    simuler(q => q === '(display-mode: standalone)')
    expect(isDesignMobile()).toBe(true)
  })

  it('design mobile pour l’application installée sur iPhone', () => {
    simuler(() => false, { standalone: true })
    expect(isDesignMobile()).toBe(true)
  })
})

import { describe, it, expect, afterEach } from 'vitest'
import { estGrandEcran, SEUIL_GRAND_ECRAN_PX } from './grandEcran'

// Même précaution que pwaStandalone.test.ts : pas de DOM dans cet environnement de test, on
// pose et retire `window` à la main pour simuler les largeurs réelles.
describe('estGrandEcran', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window')

  afterEach(() => {
    if (original) Object.defineProperty(globalThis, 'window', original)
    else Reflect.deleteProperty(globalThis, 'window')
  })

  function poserFenetre(largeurPx: number) {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        matchMedia: (q: string) => ({
          matches: q === `(min-width: ${SEUIL_GRAND_ECRAN_PX}px)` && largeurPx >= SEUIL_GRAND_ECRAN_PX,
        }),
      },
    })
  }

  it('renvoie false hors navigateur (rendu serveur)', () => {
    expect(estGrandEcran()).toBe(false)
  })

  it('renvoie false sur téléphone (y compris le plus grand, tenu à l’horizontale)', () => {
    poserFenetre(926) // iPhone Pro Max, paysage
    expect(estGrandEcran()).toBe(false)
  })

  it('renvoie false juste sous le seuil', () => {
    poserFenetre(SEUIL_GRAND_ECRAN_PX - 1)
    expect(estGrandEcran()).toBe(false)
  })

  it('renvoie true au seuil et au-delà (ordinateur)', () => {
    poserFenetre(SEUIL_GRAND_ECRAN_PX)
    expect(estGrandEcran()).toBe(true)
    poserFenetre(1440)
    expect(estGrandEcran()).toBe(true)
  })

  it('renvoie false plutôt que de lever une exception si matchMedia échoue', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { matchMedia: () => { throw new Error('non supporté') } },
    })
    expect(() => estGrandEcran()).not.toThrow()
    expect(estGrandEcran()).toBe(false)
  })
})

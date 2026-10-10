import { describe, it, expect, afterEach } from 'vitest'
import { estGrandEcran, estEcranRail, SEUIL_GRAND_ECRAN_PX, SEUIL_RAIL_PX } from './grandEcran'

// Même précaution que pwaStandalone.test.ts : pas de DOM dans cet environnement de test, on
// pose et retire `window` à la main pour simuler les largeurs réelles.
describe('estGrandEcran', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window')

  afterEach(() => {
    if (original) Object.defineProperty(globalThis, 'window', original)
    else Reflect.deleteProperty(globalThis, 'window')
  })

  function poserFenetre(largeurPx: number, pointeurFin = true) {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        matchMedia: (q: string) => ({
          matches: q === `(min-width: ${SEUIL_GRAND_ECRAN_PX}px) and (any-pointer: fine)`
            && largeurPx >= SEUIL_GRAND_ECRAN_PX && pointeurFin,
        }),
      },
    })
  }

  it('renvoie false hors navigateur (rendu serveur)', () => {
    expect(estGrandEcran()).toBe(false)
  })

  it('renvoie false sur téléphone (y compris le plus grand, tenu à l’horizontale)', () => {
    poserFenetre(926, false) // iPhone Pro Max, paysage : aucun pointeur fin
    expect(estGrandEcran()).toBe(false)
  })

  it('renvoie true sur un ordinateur affiché à 150 % (≈910px utiles), comme le rail', () => {
    poserFenetre(910)
    expect(estGrandEcran()).toBe(true)
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

// Le rail a son propre seuil, plus bas, mais assorti d'un second critère : la présence d'un
// pointeur précis. C'est ce qui permet de descendre sous les 926px d'un grand téléphone tenu à
// l'horizontale sans le faire basculer — un téléphone n'a aucun pointeur fin.
describe('estEcranRail', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window')

  afterEach(() => {
    if (original) Object.defineProperty(globalThis, 'window', original)
    else Reflect.deleteProperty(globalThis, 'window')
  })

  function poserAppareil({ largeurPx, souris }: { largeurPx: number; souris: boolean }) {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        matchMedia: (q: string) => ({
          // on évalue la requête comme le ferait un navigateur : les deux conditions ET-ées
          matches: q.includes('any-pointer: fine')
            ? largeurPx >= SEUIL_RAIL_PX && souris
            : largeurPx >= SEUIL_GRAND_ECRAN_PX,
        }),
      },
    })
  }

  it('renvoie false hors navigateur (rendu serveur)', () => {
    expect(estEcranRail()).toBe(false)
  })

  it('renvoie false sur le plus grand téléphone tenu à l’horizontale, bien qu’il dépasse le seuil', () => {
    poserAppareil({ largeurPx: 926, souris: false })
    expect(926).toBeGreaterThan(SEUIL_RAIL_PX)   // la largeur seule aurait dit oui
    expect(estEcranRail()).toBe(false)           // l’absence de souris tranche
  })

  it('sur un ordinateur portable étroit (sous l’ancien seuil de 1024), rail ET grand écran ensemble', () => {
    poserAppareil({ largeurPx: 910, souris: true })
    // Plus de zone hybride (2026-10-10) : le rail se réduit à ses icônes, les écrans prennent
    // leur mise en page ordinateur.
    expect(estEcranRail()).toBe(true)
    expect(estGrandEcran()).toBe(true)
  })

  it('renvoie false sur un ordinateur dont la fenêtre est trop étroite', () => {
    poserAppareil({ largeurPx: 700, souris: true })
    expect(estEcranRail()).toBe(false)
  })

  it('renvoie false si matchMedia échoue', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { matchMedia: () => { throw new Error('indisponible') } },
    })
    expect(estEcranRail()).toBe(false)
  })
})

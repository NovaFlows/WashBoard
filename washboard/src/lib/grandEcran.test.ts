import { describe, it, expect, afterEach } from 'vitest'
import { estGrandEcran, estEcranRail, SEUIL_GRAND_ECRAN_PX } from './grandEcran'
import { REQUETE_ECRAN_MOBILE } from './designMobile'

// Pas de DOM dans cet environnement de test : `window.matchMedia` simulé à la main.
type Appareil = { largeurPx: number; hauteurPx: number; tactileSeul: boolean }

function poser({ largeurPx, hauteurPx, tactileSeul }: Appareil) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      matchMedia: (q: string) => {
        if (q === REQUETE_ECRAN_MOBILE) return { matches: largeurPx <= 767 || (tactileSeul && hauteurPx <= 500) }
        if (q === `(min-width: ${SEUIL_GRAND_ECRAN_PX}px)`) return { matches: largeurPx >= SEUIL_GRAND_ECRAN_PX }
        throw new Error(`requête inattendue : ${q}`)
      },
    },
  })
}

const telephone = { largeurPx: 390, hauteurPx: 844, tactileSeul: true }
const telephonePaysage = { largeurPx: 926, hauteurPx: 428, tactileSeul: true }
const ipadPortrait = { largeurPx: 768, hauteurPx: 1024, tactileSeul: true }
const ipadPaysage = { largeurPx: 1024, hauteurPx: 768, tactileSeul: true }
const fenetreReduite = { largeurPx: 820, hauteurPx: 700, tactileSeul: false }
const ordinateur = { largeurPx: 1440, hauteurPx: 900, tactileSeul: false }

describe('estEcranRail / estGrandEcran', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window')

  afterEach(() => {
    if (original) Object.defineProperty(globalThis, 'window', original)
    else Reflect.deleteProperty(globalThis, 'window')
  })

  it('rendu serveur : ni rail ni grand écran', () => {
    expect(estEcranRail()).toBe(false)
    expect(estGrandEcran()).toBe(false)
  })

  it('téléphone, debout ou couché : présentation mobile', () => {
    for (const a of [telephone, telephonePaysage]) {
      poser(a)
      expect(estEcranRail()).toBe(false)
      expect(estGrandEcran()).toBe(false)
    }
  })

  it('iPad en portrait et fenêtre réduite : rail, sur une colonne', () => {
    for (const a of [ipadPortrait, fenetreReduite]) {
      poser(a)
      expect(estEcranRail()).toBe(true)
      expect(estGrandEcran()).toBe(false)
    }
  })

  it('iPad en paysage et ordinateur : rail et grand écran', () => {
    for (const a of [ipadPaysage, ordinateur]) {
      poser(a)
      expect(estEcranRail()).toBe(true)
      expect(estGrandEcran()).toBe(true)
    }
  })

  it('renvoie false plutôt que de lever une exception si matchMedia échoue', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { matchMedia: () => { throw new Error('non supporté') } },
    })
    expect(estEcranRail()).toBe(false)
    expect(estGrandEcran()).toBe(false)
  })
})

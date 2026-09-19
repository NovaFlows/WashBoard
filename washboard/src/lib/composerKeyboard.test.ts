import { describe, it, expect, afterEach } from 'vitest'
import { shouldSendOnEnter, estClavierTactile } from './composerKeyboard'

describe('shouldSendOnEnter', () => {
  it('envoie sur Entrée seule, sans clavier tactile', () => {
    expect(shouldSendOnEnter({ key: 'Enter', shiftKey: false }, false)).toBe(true)
  })

  it('ne fait rien sur Maj+Entrée : c’est le saut de ligne', () => {
    expect(shouldSendOnEnter({ key: 'Enter', shiftKey: true }, false)).toBe(false)
  })

  it('ne fait rien sur une autre touche', () => {
    expect(shouldSendOnEnter({ key: 'a', shiftKey: false }, false)).toBe(false)
  })

  it('laisse Entrée faire un saut de ligne sur clavier tactile, même sans Maj', () => {
    expect(shouldSendOnEnter({ key: 'Enter', shiftKey: false }, true)).toBe(false)
  })

  it('ignore l’Entrée qui valide une composition IME', () => {
    expect(shouldSendOnEnter({ key: 'Enter', shiftKey: false, nativeEvent: { isComposing: true } }, false)).toBe(false)
  })

  it('envoie normalement quand la composition est terminée', () => {
    expect(shouldSendOnEnter({ key: 'Enter', shiftKey: false, nativeEvent: { isComposing: false } }, false)).toBe(true)
  })
})

describe('estClavierTactile', () => {
  const original = (globalThis as { window?: unknown }).window

  afterEach(() => {
    if (original === undefined) delete (globalThis as { window?: unknown }).window
    else (globalThis as { window?: unknown }).window = original
  })

  it('suppose un clavier physique sans window (rendu serveur)', () => {
    delete (globalThis as { window?: unknown }).window
    expect(estClavierTactile()).toBe(false)
  })

  it('suppose un clavier physique si matchMedia est indisponible', () => {
    ;(globalThis as { window?: unknown }).window = {}
    expect(estClavierTactile()).toBe(false)
  })

  it('détecte un pointeur grossier via matchMedia', () => {
    ;(globalThis as { window?: unknown }).window = {
      matchMedia: (query: string) => ({ matches: query.includes('coarse') }),
    }
    expect(estClavierTactile()).toBe(true)
  })

  it('ne détecte rien quand le pointeur est fin', () => {
    ;(globalThis as { window?: unknown }).window = {
      matchMedia: () => ({ matches: false }),
    }
    expect(estClavierTactile()).toBe(false)
  })
})

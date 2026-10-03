import { describe, expect, it } from 'vitest'
import { BookingPageModeSchema, bookingPageMode, bookingPageModeEffectif, COMPTES_TEST_NOUVELLE_PAGE_RESERVATION } from './bookingPageMode'

describe('choix de page de réservation', () => {
  it('ouvre la page par défaut sans choix explicite', () => {
    for (const value of [undefined, null, '', 'unknown']) expect(bookingPageMode(value)).toBe('default')
  })
  it('conserve le choix explicite de la page classique', () => {
    expect(bookingPageMode('custom')).toBe('custom')
    expect(bookingPageMode('default')).toBe('default')
  })
  it('refuse une valeur API invalide', () => {
    for (const value of [null, '', 'legacy', {}, true]) expect(BookingPageModeSchema.safeParse(value).success).toBe(false)
    for (const value of ['default', 'custom']) expect(BookingPageModeSchema.safeParse(value).success).toBe(true)
  })
})

describe('bookingPageModeEffectif — bascule limitée aux comptes de test', () => {
  it('a bien au moins un compte dans la liste de test', () => {
    expect(COMPTES_TEST_NOUVELLE_PAGE_RESERVATION.length).toBeGreaterThan(0)
  })

  it.each(COMPTES_TEST_NOUVELLE_PAGE_RESERVATION)('respecte le choix enregistré pour le compte de test %s', (slug) => {
    expect(bookingPageModeEffectif(slug, 'default')).toBe('default')
    expect(bookingPageModeEffectif(slug, 'custom')).toBe('custom')
    // Sans choix explicite : même règle que bookingPageMode() seule — la nouvelle page.
    expect(bookingPageModeEffectif(slug, null)).toBe('default')
  })

  it('force l’ancienne page pour tout le monde d’autre, quelle que soit la valeur enregistrée', () => {
    for (const value of ['default', 'custom', null, undefined]) {
      expect(bookingPageModeEffectif('un-vrai-laveur-abc1', value)).toBe('custom')
    }
  })
})

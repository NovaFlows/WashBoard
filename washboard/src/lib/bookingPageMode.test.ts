import { describe, expect, it } from 'vitest'
import { BookingPageModeSchema, bookingPageMode } from './bookingPageMode'

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

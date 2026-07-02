import { describe, it, expect } from 'vitest'
import { toDateStr, getMondayOf } from './dateUtils'

describe('toDateStr', () => {
  it('formate en YYYY-MM-DD (timezone locale)', () => {
    expect(toDateStr(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(toDateStr(new Date(2026, 11, 31))).toBe('2026-12-31')
  })
  it('padde le mois et le jour sur 2 chiffres', () => {
    expect(toDateStr(new Date(2026, 2, 9))).toBe('2026-03-09')
  })
})

describe('getMondayOf', () => {
  it('retourne le lundi de la même semaine', () => {
    // 2026-07-01 est un mercredi — le lundi est le 29 juin
    const wed = new Date(2026, 6, 1)
    const mon = getMondayOf(wed)
    expect(toDateStr(mon)).toBe('2026-06-29')
  })
  it('retourne le lundi si on est déjà lundi', () => {
    const mon = new Date(2026, 6, 6) // lundi
    expect(toDateStr(getMondayOf(mon))).toBe('2026-07-06')
  })
  it('traite le dimanche comme fin de semaine (renvoie le lundi précédent)', () => {
    const sun = new Date(2026, 6, 5) // dimanche
    expect(toDateStr(getMondayOf(sun))).toBe('2026-06-29')
  })
  it('reset les heures à minuit', () => {
    const d = new Date(2026, 6, 1, 15, 30, 0)
    const mon = getMondayOf(d)
    expect(mon.getHours()).toBe(0)
    expect(mon.getMinutes()).toBe(0)
  })
})

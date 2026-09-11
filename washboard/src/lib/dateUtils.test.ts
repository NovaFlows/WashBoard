import { describe, it, expect } from 'vitest'
import { toDateStr, getMondayOf, formatHeure, formatHeureCompacte } from './dateUtils'

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

describe('formatHeureCompacte', () => {
  // Ce format existe pour tenir dans une case du calendrier sur téléphone,
  // où « 08:00 » se coupait en « 08:… ».
  //
  // Les heures sont écrites avec leur décalage (+02:00, heure d'été de Paris)
  // et non via `new Date(2026, 8, 4, 8, 0)`. Ce constructeur lit l'heure de la
  // MACHINE : sur la CI, en UTC, il fabriquait 8 h UTC — soit 10 h à Paris.
  // Les anciens tests passaient seulement parce que le formateur lisait, lui
  // aussi, l'heure de la machine : les deux erreurs s'annulaient et masquaient
  // le bug de fuseau pendant quatre mois.
  it('retire le zéro de tête et les minutes rondes', () => {
    expect(formatHeureCompacte(new Date('2026-09-04T08:00:00+02:00'))).toBe('8h')
    expect(formatHeureCompacte(new Date('2026-09-04T14:00:00+02:00'))).toBe('14h')
  })

  it('garde les minutes quand il y en a, sur deux chiffres', () => {
    expect(formatHeureCompacte(new Date('2026-09-04T08:30:00+02:00'))).toBe('8h30')
    expect(formatHeureCompacte(new Date('2026-09-04T09:05:00+02:00'))).toBe('9h05')
  })

  it('reste plus court que le format long, ce qui est toute sa raison d’être', () => {
    const d = new Date('2026-09-04T08:00:00+02:00')
    expect(formatHeureCompacte(d).length).toBeLessThan(formatHeure(d).length)
  })
})

import { describe, it, expect } from 'vitest'
import { generateSlots, countOverlaps, isSlotInWindows, isSlotFeasible } from './slots'

// Date de référence locale (les ISO sont construits localement pour être TZ-safe)
const date = new Date(2026, 0, 15)
const iso = (h: number, m = 0) => new Date(2026, 0, 15, h, m, 0, 0).toISOString()

describe('generateSlots', () => {
  it('génère par pas de 30 min en gardant ceux qui tiennent avant la fin', () => {
    expect(generateSlots('08:00', '10:00', 60)).toEqual(['08:00', '08:30', '09:00'])
  })
  it('renvoie vide si la durée ne tient pas', () => {
    expect(generateSlots('08:00', '08:30', 60)).toEqual([])
  })
  it('respecte un pas personnalisé', () => {
    expect(generateSlots('08:00', '09:00', 30, 60)).toEqual(['08:00'])
  })
})

describe('countOverlaps', () => {
  it('compte les réservations qui chevauchent le créneau', () => {
    const bookings = [{ scheduled_at: iso(10, 30), durationMin: 30 }] // 10:30–11:00
    expect(countOverlaps('10:00', date, 60, bookings)).toBe(1) // créneau 10:00–11:00
  })
  it('ignore celles qui ne chevauchent pas', () => {
    const bookings = [{ scheduled_at: iso(12, 0), durationMin: 60 }] // 12:00–13:00
    expect(countOverlaps('10:00', date, 60, bookings)).toBe(0)
  })
  it('compte plusieurs chevauchements', () => {
    const bookings = [
      { scheduled_at: iso(10, 0), durationMin: 60 },
      { scheduled_at: iso(10, 30), durationMin: 60 },
    ]
    expect(countOverlaps('10:00', date, 60, bookings)).toBe(2)
  })
})

describe('isSlotInWindows', () => {
  const win = [{ start: iso(9, 0), end: iso(11, 0) }]
  it('détecte un créneau dans la fenêtre', () => {
    expect(isSlotInWindows('10:00', date, win)).toBe(true)
  })
  it('exclut un créneau hors fenêtre', () => {
    expect(isSlotInWindows('12:00', date, win)).toBe(false)
  })
})

describe('isSlotFeasible', () => {
  it('toujours faisable sans contrainte', () => {
    expect(isSlotFeasible('10:00', date, 60, [])).toBe(true)
  })
  it('faisable si le trajet depuis le RDV précédent rentre', () => {
    const before = { start: iso(9, 0), end: iso(9, 30), travelToNew: 600, travelFromNew: 0 } // 10 min
    expect(isSlotFeasible('10:00', date, 60, [before])).toBe(true)
  })
  it('infaisable si le trajet est trop long', () => {
    const tight = { start: iso(9, 0), end: iso(9, 30), travelToNew: 3600, travelFromNew: 0 } // 60 min
    expect(isSlotFeasible('10:00', date, 60, [tight])).toBe(false)
  })
  it('infaisable si un RDV chevauche directement', () => {
    const clash = { start: iso(10, 15), end: iso(10, 45), travelToNew: 0, travelFromNew: 0 }
    expect(isSlotFeasible('10:00', date, 60, [clash])).toBe(false)
  })
})

import { describe, it, expect } from 'vitest'
import {
  getCrmPeriodBounds,
  isInCrmPeriod,
  crmPeriodLabel,
  type CrmPeriodState,
} from './crmPeriod'

const base: CrmPeriodState = {
  type: 'all',
  year: 2026,
  month: 8, // septembre
  weekStart: new Date(2026, 8, 7), // lundi 7 septembre
  day: '2026-09-04',
}

describe('getCrmPeriodBounds', () => {
  it('ne borne rien sur « Tout »', () => {
    // `null` et non une plage très large : l'appelant doit ne filtrer sur rien.
    expect(getCrmPeriodBounds(base)).toBeNull()
  })

  it('borne une année civile', () => {
    const b = getCrmPeriodBounds({ ...base, type: 'year' })!
    expect(b.start).toEqual(new Date(2026, 0, 1))
    expect(b.end).toEqual(new Date(2027, 0, 1))
  })

  it('borne un mois, fin exclue', () => {
    const b = getCrmPeriodBounds({ ...base, type: 'month' })!
    expect(b.start).toEqual(new Date(2026, 8, 1))
    expect(b.end).toEqual(new Date(2026, 9, 1))
  })

  it('borne sept jours pleins à partir du lundi', () => {
    const b = getCrmPeriodBounds({ ...base, type: 'week' })!
    expect(b.start).toEqual(new Date(2026, 8, 7, 0, 0, 0, 0))
    expect(b.end).toEqual(new Date(2026, 8, 14, 0, 0, 0, 0))
  })

  it('borne une journée dans le fuseau local, pas en UTC', () => {
    // `new Date('2026-09-04')` serait lu en UTC : en France, la journée
    // commencerait la veille à 2 h et les rendez-vous du 3 apparaîtraient
    // dans le 4.
    const b = getCrmPeriodBounds({ ...base, type: 'day' })!
    expect(b.start).toEqual(new Date(2026, 8, 4))
    expect(b.end).toEqual(new Date(2026, 8, 5))
    expect(b.start.getDate()).toBe(4)
  })

  it('refuse une date de jour illisible', () => {
    expect(getCrmPeriodBounds({ ...base, type: 'day', day: 'n’importe quoi' })).toBeNull()
  })
})

describe('isInCrmPeriod', () => {
  it('accepte tout sur « Tout »', () => {
    expect(isInCrmPeriod(new Date(1999, 0, 1), base)).toBe(true)
  })

  it('inclut la borne de début et exclut celle de fin', () => {
    // Sans cette règle, un rendez-vous du 1er octobre compterait à la fois
    // dans septembre et dans octobre.
    const mois: CrmPeriodState = { ...base, type: 'month' }
    expect(isInCrmPeriod(new Date(2026, 8, 1, 0, 0, 0), mois)).toBe(true)
    expect(isInCrmPeriod(new Date(2026, 9, 1, 0, 0, 0), mois)).toBe(false)
    expect(isInCrmPeriod(new Date(2026, 8, 30, 23, 59), mois)).toBe(true)
  })

  it('écarte une date invalide au lieu de la laisser passer', () => {
    expect(isInCrmPeriod(new Date('pas une date'), { ...base, type: 'month' })).toBe(false)
  })

  it('couvre exactement la semaine choisie', () => {
    const sem: CrmPeriodState = { ...base, type: 'week' }
    expect(isInCrmPeriod(new Date(2026, 8, 6, 23, 59), sem)).toBe(false)
    expect(isInCrmPeriod(new Date(2026, 8, 7), sem)).toBe(true)
    expect(isInCrmPeriod(new Date(2026, 8, 13, 23, 59), sem)).toBe(true)
    expect(isInCrmPeriod(new Date(2026, 8, 14), sem)).toBe(false)
  })
})

describe('crmPeriodLabel', () => {
  it('nomme chaque période pour qu’on sache sur quoi portent les chiffres', () => {
    expect(crmPeriodLabel(base)).toBe('Depuis le début')
    expect(crmPeriodLabel({ ...base, type: 'year' })).toBe('En 2026')
    expect(crmPeriodLabel({ ...base, type: 'month' })).toMatch(/septembre 2026/)
    expect(crmPeriodLabel({ ...base, type: 'week' })).toMatch(/^Du .+ au .+$/)
    expect(crmPeriodLabel({ ...base, type: 'day' })).toMatch(/4 septembre/)
  })
})

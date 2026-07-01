import { describe, it, expect } from 'vitest'
import { getDeptCodeFromPostal, DEPARTMENTS } from './france-departments'

describe('getDeptCodeFromPostal', () => {
  it('métropole : 2 premiers chiffres', () => {
    expect(getDeptCodeFromPostal('75001')).toBe('75')
    expect(getDeptCodeFromPostal('69003')).toBe('69')
    expect(getDeptCodeFromPostal('13008')).toBe('13')
  })

  it('conserve le zéro initial (01–09)', () => {
    expect(getDeptCodeFromPostal('01000')).toBe('01')
    expect(getDeptCodeFromPostal('06600')).toBe('06')
  })

  it('Corse : 2A (Corse-du-Sud) et 2B (Haute-Corse)', () => {
    expect(getDeptCodeFromPostal('20000')).toBe('2A') // Ajaccio (200xx)
    expect(getDeptCodeFromPostal('20090')).toBe('2A') // 200xx
    expect(getDeptCodeFromPostal('20167')).toBe('2A') // 201xx
    expect(getDeptCodeFromPostal('20200')).toBe('2B') // Bastia (202xx)
    expect(getDeptCodeFromPostal('20600')).toBe('2B')
  })

  it('DOM : 3 chiffres (971–976)', () => {
    expect(getDeptCodeFromPostal('97100')).toBe('971') // Guadeloupe
    expect(getDeptCodeFromPostal('97200')).toBe('972') // Martinique
    expect(getDeptCodeFromPostal('97300')).toBe('973') // Guyane
    expect(getDeptCodeFromPostal('97400')).toBe('974') // Réunion
    expect(getDeptCodeFromPostal('97600')).toBe('976') // Mayotte
  })

  it('chaque code résolu existe dans la liste DEPARTMENTS (hors 977+)', () => {
    const codes = new Set(DEPARTMENTS.map(d => d.code))
    for (const cp of ['75001', '01000', '20000', '20200', '97100', '97400']) {
      expect(codes.has(getDeptCodeFromPostal(cp))).toBe(true)
    }
  })
})

describe('DEPARTMENTS (données)', () => {
  it('contient les 96 départements métropolitains + 5 DOM', () => {
    expect(DEPARTMENTS.length).toBe(101)
  })
  it('codes uniques', () => {
    const codes = DEPARTMENTS.map(d => d.code)
    expect(new Set(codes).size).toBe(codes.length)
  })
})

import { describe, it, expect } from 'vitest'
import { formationOuverte } from './formationAcces'

describe('formationOuverte', () => {
  it('fermée à tous sans réglage', () => {
    expect(formationOuverte('u-1', {})).toBe(false)
  })
  it('ouverte aux seuls comptes listés', () => {
    const env = { FORMATION_USER_IDS: 'u-1, u-2 ,' }
    expect(formationOuverte('u-1', env)).toBe(true)
    expect(formationOuverte('u-2', env)).toBe(true)
    expect(formationOuverte('u-3', env)).toBe(false)
  })
  it('FORMATION_OUVERTE=1 l’ouvre à tous les comptes connectés', () => {
    expect(formationOuverte('u-9', { FORMATION_OUVERTE: '1' })).toBe(true)
    expect(formationOuverte('u-9', { FORMATION_OUVERTE: 'oui' })).toBe(false)
  })
  it('jamais ouverte sans compte', () => {
    expect(formationOuverte(null, { FORMATION_OUVERTE: '1' })).toBe(false)
    expect(formationOuverte(undefined, { FORMATION_USER_IDS: '' })).toBe(false)
  })
})

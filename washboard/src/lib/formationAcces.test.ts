import { describe, it, expect } from 'vitest'
import { formationAdmin, formationOuverte } from './formationAcces'

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

describe('formationAdmin', () => {
  it('reconnaît un identifiant de la liste administrateurs, et lui ouvre l’onglet', () => {
    const env = { FORMATION_ADMIN_USER_IDS: 'a, b' }
    expect(formationAdmin('b', env)).toBe(true)
    expect(formationOuverte('b', env)).toBe(true)
  })
  it('un simple laveur autorisé n’est pas administrateur', () => {
    const env = { FORMATION_USER_IDS: 'x', FORMATION_ADMIN_USER_IDS: 'a' }
    expect(formationOuverte('x', env)).toBe(true)
    expect(formationAdmin('x', env)).toBe(false)
  })
  it('personne sans variable, ni sans identifiant', () => {
    expect(formationAdmin('a', {})).toBe(false)
    expect(formationAdmin(null, { FORMATION_ADMIN_USER_IDS: 'a' })).toBe(false)
  })
})

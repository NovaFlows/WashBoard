import { describe, it, expect } from 'vitest'
import { uuidValide } from './uuid'

describe('uuidValide', () => {
  it('accepte un UUID valide', () => {
    expect(uuidValide('041793cc-1f4c-4d33-a6f2-59f92d86bdae')).toBe(true)
    expect(uuidValide('041793CC-1F4C-4D33-A6F2-59F92D86BDAE')).toBe(true)
  })

  it('refuse le cas qui a produit l’erreur Postgres en production : la chaîne littérale "undefined"', () => {
    expect(uuidValide('undefined')).toBe(false)
  })

  it('refuse un format approchant mais invalide', () => {
    expect(uuidValide('')).toBe(false)
    expect(uuidValide('041793cc-1f4c-4d33-a6f2-59f92d86bda')).toBe(false) // un caractère de moins
    expect(uuidValide('041793cc1f4c4d33a6f259f92d86bdae')).toBe(false) // sans tirets
    expect(uuidValide('not-a-uuid')).toBe(false)
  })
})

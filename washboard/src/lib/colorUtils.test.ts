import { describe, it, expect } from 'vitest'
import { hex } from './colorUtils'

describe('hex', () => {
  it('ajoute ff pour opacity 1', () => {
    expect(hex('#abc', 1)).toBe('#abcff')
  })
  it('ajoute 00 pour opacity 0', () => {
    expect(hex('#abc', 0)).toBe('#abc00')
  })
  it('arrondit et padde à 2 chiffres', () => {
    expect(hex('#abc', 0.5)).toBe('#abc80')
  })
})

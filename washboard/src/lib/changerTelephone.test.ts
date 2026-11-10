import { describe, it, expect } from 'vitest'
import { codeValide, verifierNouveauNumero } from './changerTelephone'

describe('verifierNouveauNumero', () => {
  it('normalise un mobile français, quelle que soit l’écriture', () => {
    expect(verifierNouveauNumero('06 12 34 56 78', '0700000000')).toEqual({ telephone: '0612345678' })
    expect(verifierNouveauNumero('+33 7 12 34 56 78', null)).toEqual({ telephone: '0712345678' })
  })
  it('refuse ce qui n’est pas un numéro', () => {
    expect(verifierNouveauNumero('12', null)).toHaveProperty('erreur')
    expect(verifierNouveauNumero(undefined, null)).toHaveProperty('erreur')
    expect(verifierNouveauNumero(612345678, null)).toHaveProperty('erreur')
  })
  it('refuse un fixe : le code arrive par SMS', () => {
    expect(verifierNouveauNumero('01 23 45 67 89', null)).toMatchObject({ erreur: expect.stringContaining('mobile') })
  })
  it('refuse le numéro que le laveur a déjà, écrit autrement', () => {
    expect(verifierNouveauNumero('+33612345678', '06 12 34 56 78')).toMatchObject({ erreur: 'C’est déjà votre numéro.' })
  })
})

describe('codeValide', () => {
  it('six chiffres, et rien d’autre', () => {
    expect(codeValide('123456')).toBe(true)
    expect(codeValide(' 123456 ')).toBe(true)
    expect(codeValide('12345')).toBe(false)
    expect(codeValide('12345a')).toBe(false)
    expect(codeValide(123456)).toBe(false)
  })
})

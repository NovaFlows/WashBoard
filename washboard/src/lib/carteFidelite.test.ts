import { describe, it, expect } from 'vitest'
import { COULEUR_CARTE_DEFAUT, couleurCarte, couleurValide, numeroCarte, teintesCarte, variablesCarte } from './carteFidelite'

describe('couleur de la carte', () => {
  it('celle choisie, sinon la couleur de marque, sinon le violet', () => {
    expect(couleurCarte('#0f7a55', '#1d4ed8')).toBe('#0F7A55')
    expect(couleurCarte(undefined, '#1d4ed8')).toBe('#1D4ED8')
    expect(couleurCarte(null, null)).toBe(COULEUR_CARTE_DEFAUT)
  })
  it('ignore une valeur qui n’est pas une couleur', () => {
    expect(couleurValide('#12345')).toBe(false)
    expect(couleurValide('red')).toBe(false)
    expect(couleurCarte('url(javascript:alert(1))', 'rouge')).toBe(COULEUR_CARTE_DEFAUT)
  })
})

describe('teintes déduites de la couleur', () => {
  it('garde la couleur de base, éclaircit et assombrit autour', () => {
    const t = teintesCarte('#6D28D9')
    expect(t.base).toBe('#6D28D9')
    const lum = (hex: string) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16)
    expect(lum(t.clair)).toBeGreaterThan(lum(t.base))
    expect(lum(t.sombre)).toBeLessThan(lum(t.base))
    expect(t.halo).toMatch(/^#[0-9A-F]{8}$/)
  })
  it('texte clair sur une carte foncée, foncé sur une carte claire', () => {
    expect(teintesCarte('#1F1F2A').texte).toMatch(/^rgba\(255/)
    expect(teintesCarte('#F5E663').texte).toMatch(/^rgba\(22/)
  })
  it('encre des tampons lisible sur le papier, même pour une carte très claire', () => {
    const encre = teintesCarte('#FAFAFA').encre
    const somme = parseInt(encre.slice(1, 3), 16) + parseInt(encre.slice(3, 5), 16) + parseInt(encre.slice(5, 7), 16)
    expect(somme).toBeLessThan(3 * 120)
  })
  it('rend les variables CSS du composant', () => {
    expect(variablesCarte('#0F7A55')).toMatchObject({ '--wb-cf-c': '#0F7A55' })
  })
})

describe('numéro de carte', () => {
  it('tiré du jeton, sans rien dire du client', () => {
    expect(numeroCarte('4f2a9c0e')).toBe('4F2A')
    expect(numeroCarte(null)).toBeNull()
    expect(numeroCarte('zz')).toBeNull()
  })
})

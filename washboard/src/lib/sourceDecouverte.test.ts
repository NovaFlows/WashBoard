import { describe, it, expect } from 'vitest'
import { SOURCES_DECOUVERTE, SourceDecouverteSchema, estSourceDecouverte, libelleSourceDecouverte } from './sourceDecouverte'

describe('sourceDecouverte', () => {
  it('expose une liste fermée de valeurs', () => {
    expect(SOURCES_DECOUVERTE.map(s => s.valeur)).toEqual([
      'bouche_a_oreille', 'camionnette', 'instagram', 'tiktok', 'google', 'autre',
    ])
  })

  it('accepte chaque valeur de la liste', () => {
    for (const s of SOURCES_DECOUVERTE) {
      expect(estSourceDecouverte(s.valeur)).toBe(true)
      expect(SourceDecouverteSchema.safeParse(s.valeur).success).toBe(true)
    }
  })

  it('refuse une chaîne libre (pas de texte arbitraire côté client)', () => {
    expect(estSourceDecouverte('Facebook')).toBe(false)
    expect(estSourceDecouverte('<script>')).toBe(false)
    expect(estSourceDecouverte('')).toBe(false)
    expect(estSourceDecouverte(undefined)).toBe(false)
    expect(estSourceDecouverte(null)).toBe(false)
  })

  it('donne un libellé lisible pour chaque valeur', () => {
    expect(libelleSourceDecouverte('camionnette')).toBe('J’ai vu la camionnette')
    expect(libelleSourceDecouverte('google')).toBe('Google')
  })
})

import { describe, it, expect } from 'vitest'
import { ReglagesCentreAutoSchema, centreAutoPublic, lieuAccepte, lieuParDefaut, resumeCentreAuto } from './centreAuto'

const adresse = '12 rue des Lilas, 93100 Montreuil'

describe('centreAutoPublic', () => {
  it('rien sans réglage, réglage illisible ou centre éteint : à domicile seulement', () => {
    expect(centreAutoPublic(null)).toBeNull()
    expect(centreAutoPublic({ foo: 1 })).toBeNull()
    expect(centreAutoPublic({ actif: false, adresse, lieux: 'les_deux' })).toBeNull()
  })
  it('centre déclaré mais page « à domicile seulement » : rien ne change côté client', () => {
    expect(centreAutoPublic({ actif: true, adresse, lieux: 'domicile' })).toBeNull()
  })
  it('centre sans adresse : jamais proposé (le client ne saurait pas où aller)', () => {
    expect(centreAutoPublic({ actif: true, adresse: '', lieux: 'centre' })).toBeNull()
  })
  it('les deux ou centre seulement', () => {
    expect(centreAutoPublic({ actif: true, adresse, lieux: 'les_deux' })).toEqual({ adresse, domicile: true })
    expect(centreAutoPublic({ actif: true, adresse, lieux: 'centre' })).toEqual({ adresse, domicile: false })
  })
})

describe('lieu', () => {
  const lesDeux = { adresse, domicile: true }
  const centreSeul = { adresse, domicile: false }
  it('à domicile coché par défaut dès qu’il est proposé', () => {
    expect(lieuParDefaut(null)).toBe('domicile')
    expect(lieuParDefaut(lesDeux)).toBe('domicile')
    expect(lieuParDefaut(centreSeul)).toBe('centre')
  })
  it('refuse un lieu que le laveur ne propose pas', () => {
    expect(lieuAccepte(null, 'domicile')).toBe(true)
    expect(lieuAccepte(null, 'centre')).toBe(false)
    expect(lieuAccepte(lesDeux, 'centre')).toBe(true)
    expect(lieuAccepte(lesDeux, 'domicile')).toBe(true)
    expect(lieuAccepte(centreSeul, 'domicile')).toBe(false)
  })
})

describe('réglages', () => {
  it('adresse exigée quand le centre est déclaré', () => {
    expect(ReglagesCentreAutoSchema.safeParse({ actif: true, adresse: ' ', lieux: 'centre' }).success).toBe(false)
    expect(ReglagesCentreAutoSchema.safeParse({ actif: false, adresse: '', lieux: 'les_deux' }).success).toBe(true)
  })
  it('résumé de la ligne « Centre auto »', () => {
    expect(resumeCentreAuto(null)).toBe('Non')
    expect(resumeCentreAuto({ actif: true, adresse, lieux: 'les_deux' })).toBe('Oui · page : à domicile et en centre auto')
  })
})

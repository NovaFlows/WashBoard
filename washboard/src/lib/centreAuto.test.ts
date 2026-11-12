import { describe, it, expect } from 'vitest'
import { ReglagesCentreAutoSchema, adresseAvecLieu, centreAutoPublic, centreParAdresse, centresDe, libelleAdresse, libelleCentre, lieuAccepte, lieuParDefaut, lieuRestreintValide, lieuxPossibles, normaliserReglages, resumeCentreAuto } from './centreAuto'

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

describe('affichage après la réservation', () => {
  it('le client et le laveur savent que le rendez-vous est au centre', () => {
    expect(libelleAdresse('centre')).toBe('Au centre auto')
    expect(adresseAvecLieu(adresse, 'centre')).toBe(`Centre auto · ${adresse}`)
  })
  it('à domicile, ou colonne absente : rien ne change', () => {
    expect(libelleAdresse('domicile')).toBe('Adresse')
    expect(libelleAdresse(undefined)).toBe('Adresse')
    expect(adresseAvecLieu(adresse, null)).toBe(adresse)
  })
})

describe('plusieurs centres', () => {
  const lyon = '8 avenue Foch, 69006 Lyon'
  const centres = [{ nom: 'Montreuil', adresse }, { nom: 'Lyon', adresse: lyon }]
  const reglage = { actif: true, adresse, lieux: 'les_deux', centres }

  it('un seul centre garde la forme d’avant, deux ou plus exposent la liste', () => {
    expect(centreAutoPublic({ actif: true, adresse, lieux: 'centre', centres: [{ nom: 'A', adresse }] })).toEqual({ adresse, domicile: false })
    expect(centreAutoPublic(reglage)).toEqual({ adresse, domicile: true, centres })
  })
  it('l’adresse du premier centre est celle par défaut, même si l’ancien champ est vide', () => {
    expect(centreAutoPublic({ ...reglage, adresse: '' })?.adresse).toBe(adresse)
  })
  it('refuse un centre sans adresse valable quand le centre est actif', () => {
    expect(ReglagesCentreAutoSchema.safeParse({ ...reglage, centres: [...centres, { nom: 'X', adresse: 'ab' }] }).success).toBe(false)
    expect(ReglagesCentreAutoSchema.safeParse({ actif: true, adresse: '', lieux: 'centre', centres: [] }).success).toBe(false)
    expect(ReglagesCentreAutoSchema.safeParse({ ...reglage, centres: Array(11).fill(centres[0]) }).success).toBe(false)
  })
  it('normaliser : l’adresse unique suit le premier centre', () => {
    const r = ReglagesCentreAutoSchema.parse({ ...reglage, adresse: 'autre' })
    expect(normaliserReglages(r).adresse).toBe(adresse)
  })
  it('le serveur ne retient qu’une adresse de la liste, sinon le premier centre', () => {
    const pub = centreAutoPublic(reglage)!
    expect(centreParAdresse(pub, ` ${lyon} `).nom).toBe('Lyon')
    expect(centreParAdresse(pub, '1 rue inventée, 75000 Paris').nom).toBe('Montreuil')
    expect(centreParAdresse(pub, undefined).adresse).toBe(adresse)
    expect(centresDe({ adresse, domicile: true })).toEqual([{ nom: '', adresse }])
  })
  it('l’adresse du rendez-vous porte le nom du centre', () => {
    expect(libelleCentre(centres[1])).toBe(`Lyon · ${lyon}`)
    expect(libelleCentre({ nom: '', adresse })).toBe(adresse)
  })
  it('résumé : le nombre de centres', () => {
    expect(resumeCentreAuto(reglage)).toBe('Oui · 2 centres · page : à domicile et en centre auto')
  })
})

describe('prestation limitée à un lieu', () => {
  const lesDeux = { adresse, domicile: true }
  const centreSeul = { adresse, domicile: false }
  it('sans restriction : tout ce que le laveur propose', () => {
    expect(lieuxPossibles(null, null)).toEqual(['domicile'])
    expect(lieuxPossibles(lesDeux, undefined)).toEqual(['domicile', 'centre'])
    expect(lieuxPossibles(centreSeul, null)).toEqual(['centre'])
  })
  it('restreinte : un seul lieu quand le laveur propose les deux', () => {
    expect(lieuxPossibles(lesDeux, 'domicile')).toEqual(['domicile'])
    expect(lieuxPossibles(lesDeux, 'centre')).toEqual(['centre'])
  })
  it('restriction sur un lieu que le laveur ne propose pas : réservable nulle part', () => {
    expect(lieuxPossibles(null, 'centre')).toEqual([])
    expect(lieuxPossibles(centreSeul, 'domicile')).toEqual([])
  })
  it('valeur inconnue en base : pas de restriction', () => {
    expect(lieuRestreintValide('centre')).toBe('centre')
    expect(lieuRestreintValide('domicile')).toBe('domicile')
    expect(lieuRestreintValide('autre')).toBeNull()
    expect(lieuRestreintValide(undefined)).toBeNull()
  })
})

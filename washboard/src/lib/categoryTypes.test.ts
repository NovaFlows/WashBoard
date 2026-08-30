import { describe, it, expect } from 'vitest'
import { sanitizeTypes } from './categoryTypes'

// Frontière de confiance : la charge vient du navigateur. Ces tests couvrent
// surtout ce qu'un client mal intentionné ou un bug de formulaire peut envoyer.
describe('sanitizeTypes', () => {
  it('conserve les types valides tels quels', () => {
    const r = sanitizeTypes([{ id: 'abc', name: 'Citadine' }, { id: 'def', name: 'SUV' }])
    expect(r).toEqual([{ id: 'abc', name: 'Citadine' }, { id: 'def', name: 'SUV' }])
  })

  it('renvoie une liste vide si l’entrée n’est pas un tableau', () => {
    expect(sanitizeTypes(null)).toEqual([])
    expect(sanitizeTypes(undefined)).toEqual([])
    expect(sanitizeTypes('Citadine')).toEqual([])
    expect(sanitizeTypes({ name: 'Citadine' })).toEqual([])
    expect(sanitizeTypes(42)).toEqual([])
  })

  it('écarte les types sans nom exploitable', () => {
    // Un type sans libellé afficherait un bouton vide sur la page publique.
    const r = sanitizeTypes([
      { id: '1', name: 'Citadine' },
      { id: '2', name: '' },
      { id: '3', name: '   ' },
      { id: '4' },
      { id: '5', name: 123 },
      null,
    ])
    expect(r).toHaveLength(1)
    expect(r[0].name).toBe('Citadine')
  })

  it('supprime les espaces autour du nom', () => {
    expect(sanitizeTypes([{ id: '1', name: '  Berline  ' }])[0].name).toBe('Berline')
  })

  it('génère un identifiant quand il manque ou n’est pas une chaîne', () => {
    // Sans identifiant stable, les prestations rattachées perdraient leur lien.
    const r = sanitizeTypes([{ name: 'Citadine' }, { id: 42, name: 'SUV' }, { id: '', name: 'Van' }])
    expect(r).toHaveLength(3)
    for (const t of r) {
      expect(typeof t.id).toBe('string')
      expect(t.id.length).toBeGreaterThan(0)
    }
    // Deux identifiants générés ne doivent pas se télescoper.
    expect(new Set(r.map(t => t.id)).size).toBe(3)
  })

  it('ignore les champs supplémentaires envoyés par le client', () => {
    // Rien d'autre que id/name ne doit atteindre la base.
    const r = sanitizeTypes([{ id: '1', name: 'Citadine', prix: 9999, admin: true }])
    expect(Object.keys(r[0]).sort()).toEqual(['id', 'name'])
  })

  it('accepte une liste vide', () => {
    expect(sanitizeTypes([])).toEqual([])
  })
})

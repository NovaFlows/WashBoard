import { describe, it, expect } from 'vitest'
import { filtrerHeures, heureAutorisee, heuresDebutAcceptables, heuresDebutValides, resumeHeures, HEURES_PROPOSEES } from './heuresPrestation'

describe('heuresDebutValides', () => {
  it('trie, dédoublonne et écarte ce qui n’est pas une heure', () => {
    expect(heuresDebutValides(['16:00', '08:30', '08:30', '25:00', 'abc', 8])).toEqual(['08:30', '16:00'])
  })
  it('rien ou liste vide : pas de restriction', () => {
    expect(heuresDebutValides(null)).toBeNull()
    expect(heuresDebutValides(undefined)).toBeNull()
    expect(heuresDebutValides([])).toBeNull()
    expect(heuresDebutValides('08:30')).toBeNull()
  })
})

describe('heuresDebutAcceptables', () => {
  it('absente, nulle ou bien formée', () => {
    expect(heuresDebutAcceptables(undefined)).toBe(true)
    expect(heuresDebutAcceptables(null)).toBe(true)
    expect(heuresDebutAcceptables([])).toBe(true)
    expect(heuresDebutAcceptables(['08:30', '13:00'])).toBe(true)
  })
  it('refuse le reste', () => {
    expect(heuresDebutAcceptables(['8h30'])).toBe(false)
    expect(heuresDebutAcceptables('08:30')).toBe(false)
    expect(heuresDebutAcceptables(Array(13).fill('08:30'))).toBe(false)
  })
})

describe('filtrerHeures / heureAutorisee', () => {
  const jour = ['08:00', '08:30', '09:00', '13:00', '13:30', '16:00']
  it('ne garde que les heures autorisées', () => {
    expect(filtrerHeures(jour, ['08:30', '13:00', '16:00'])).toEqual(['08:30', '13:00', '16:00'])
  })
  it('une heure autorisée mais hors horaires n’apparaît pas', () => {
    expect(filtrerHeures(['09:00'], ['08:30'])).toEqual([])
  })
  it('sans restriction : tout', () => {
    expect(filtrerHeures(jour, null)).toEqual(jour)
    expect(filtrerHeures(jour, [])).toEqual(jour)
  })
  it('contrôle serveur', () => {
    expect(heureAutorisee('13:00', ['08:30', '13:00'])).toBe(true)
    expect(heureAutorisee('14:00', ['08:30', '13:00'])).toBe(false)
    expect(heureAutorisee('14:00', null)).toBe(true)
  })
})

describe('affichage', () => {
  it('résumé', () => {
    expect(resumeHeures(['16:00', '08:30', '13:00'])).toBe('8 h 30 · 13 h · 16 h')
    expect(resumeHeures(null)).toBe('Toutes')
  })
  it('les heures proposées vont de 6 h à 21 h 30 par demi-heure', () => {
    expect(HEURES_PROPOSEES[0]).toBe('06:00')
    expect(HEURES_PROPOSEES.at(-1)).toBe('21:30')
    expect(HEURES_PROPOSEES).toHaveLength(32)
  })
})

import { describe, it, expect } from 'vitest'
import {
  anneeMois, lireFiltre, filtrerFactures, anneesDisponibles, moisDisponibles, libelleMois,
} from './listeFactures'

const factures = [
  { numero: 'F-00001', facture_emise_le: '2025-11-20T10:00:00.000Z' },
  { numero: 'F-00002', facture_emise_le: '2026-08-03T10:00:00.000Z' },
  { numero: 'F-00003', facture_emise_le: '2026-09-14T15:00:00.000Z' },
  { numero: 'F-00004', facture_emise_le: '2026-09-15T08:00:00.000Z' },
]

describe('anneeMois', () => {
  it('lit la date à l’heure de Paris, pas en UTC', () => {
    // 31 décembre 23 h 30 UTC = 1er janvier 0 h 30 à Paris.
    expect(anneeMois('2026-12-31T23:30:00.000Z')).toEqual({ annee: '2027', mois: '01' })
    // 31 décembre 22 h 30 UTC = 23 h 30 à Paris : toujours décembre.
    expect(anneeMois('2026-12-31T22:30:00.000Z')).toEqual({ annee: '2026', mois: '12' })
  })
})

describe('lireFiltre', () => {
  it('sans paramètre : tout', () => {
    expect(lireFiltre({})).toEqual({ annee: null, mois: null })
  })

  it('année seule, ou année et mois', () => {
    expect(lireFiltre({ annee: '2026' })).toEqual({ annee: '2026', mois: null })
    expect(lireFiltre({ annee: '2026', mois: '09' })).toEqual({ annee: '2026', mois: '09' })
  })

  it('valeurs farfelues ignorées, et pas de mois sans année', () => {
    expect(lireFiltre({ annee: 'abc', mois: '09' })).toEqual({ annee: null, mois: null })
    expect(lireFiltre({ annee: '2026', mois: '13' })).toEqual({ annee: '2026', mois: null })
    expect(lireFiltre({ mois: '09' })).toEqual({ annee: null, mois: null })
    expect(lireFiltre({ annee: ['2026', '2025'] })).toEqual({ annee: null, mois: null })
  })
})

describe('filtrerFactures', () => {
  it('tout, une année, un mois', () => {
    expect(filtrerFactures(factures, { annee: null, mois: null })).toHaveLength(4)
    expect(filtrerFactures(factures, { annee: '2026', mois: null }).map(f => f.numero)).toEqual(['F-00002', 'F-00003', 'F-00004'])
    expect(filtrerFactures(factures, { annee: '2026', mois: '09' }).map(f => f.numero)).toEqual(['F-00003', 'F-00004'])
  })
})

describe('années et mois disponibles', () => {
  it('seulement ceux qui ont des factures, les plus récents d’abord', () => {
    expect(anneesDisponibles(factures)).toEqual(['2026', '2025'])
    expect(moisDisponibles(factures, '2026')).toEqual(['09', '08'])
    expect(moisDisponibles(factures, '2024')).toEqual([])
  })

  it('libellé du mois en français', () => {
    expect(libelleMois('08')).toBe('août')
  })
})

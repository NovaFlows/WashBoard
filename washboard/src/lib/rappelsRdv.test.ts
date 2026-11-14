import { describe, expect, it } from 'vitest'
import {
  RAPPEL_HEURES_DEFAUT, RAPPEL_NB_MAX, heuresEnvoyees, libelleHeuresAvant, normaliserHeures, rappelsActifs, rappelsDus, resumeRappels,
} from './rappelsRdv'

const H = 3_600_000
const RDV = '2026-11-20T14:00:00Z'
const rdvMs = Date.parse(RDV)

describe('normaliserHeures', () => {
  it('garde les entiers valides, sans doublon, du plus lointain au plus proche', () => {
    expect(normaliserHeures([3, 24, 3, 48])).toEqual([48, 24, 3])
  })
  it('écarte ce qui est hors bornes ou illisible', () => {
    expect(normaliserHeures([0, -2, 169, 'abc', null, 6.9])).toEqual([6])
  })
  it('plafonne le nombre de rappels', () => {
    expect(normaliserHeures([1, 2, 3, 4, 5])).toHaveLength(RAPPEL_NB_MAX)
  })
  it('pas de liste (colonne absente, null) : les valeurs par défaut', () => {
    expect(normaliserHeures(undefined)).toEqual([...RAPPEL_HEURES_DEFAUT])
    expect(normaliserHeures(null)).toEqual([...RAPPEL_HEURES_DEFAUT])
  })
  it('une liste vide reste vide : le laveur n\'a rien choisi', () => {
    expect(normaliserHeures([])).toEqual([])
  })
})

describe('rappelsActifs', () => {
  it('allumé par défaut, seul un false explicite coupe', () => {
    expect(rappelsActifs(undefined)).toBe(true)
    expect(rappelsActifs(null)).toBe(true)
    expect(rappelsActifs(true)).toBe(true)
    expect(rappelsActifs(false)).toBe(false)
  })
})

describe('rappelsDus', () => {
  const base = { rdvLe: RDV, creeLe: '2026-11-10T09:00:00Z', heures: [24, 3], deja: [] as number[] }

  it('rien avant l\'heure du premier rappel', () => {
    expect(rappelsDus({ ...base, maintenant: rdvMs - 25 * H })).toEqual([])
  })
  it('le premier rappel part 24 h avant', () => {
    expect(rappelsDus({ ...base, maintenant: rdvMs - 24 * H })).toEqual([24])
    expect(rappelsDus({ ...base, maintenant: rdvMs - 23.5 * H })).toEqual([24])
  })
  it('le second part 3 h avant, le premier n\'est pas renvoyé', () => {
    expect(rappelsDus({ ...base, deja: [24], maintenant: rdvMs - 3 * H })).toEqual([3])
    expect(rappelsDus({ ...base, deja: [24, 3], maintenant: rdvMs - 1 * H })).toEqual([])
  })
  it('cron arrêté : plusieurs rappels échus d\'un coup sont tous rendus', () => {
    expect(rappelsDus({ ...base, maintenant: rdvMs - 2 * H }).sort((a, b) => b - a)).toEqual([24, 3])
  })
  it('un rendez-vous pris après l\'heure d\'un rappel ne reçoit pas ce rappel', () => {
    // pris la veille à 20 h pour 14 h le lendemain : « 24 h avant » était déjà passé
    const r = { ...base, creeLe: '2026-11-19T20:00:00Z', maintenant: rdvMs - 4 * H }
    expect(rappelsDus(r)).toEqual([])
    expect(rappelsDus({ ...r, maintenant: rdvMs - 3 * H })).toEqual([3])
  })
  it('plus aucun rappel une fois le rendez-vous commencé', () => {
    expect(rappelsDus({ ...base, maintenant: rdvMs })).toEqual([])
    expect(rappelsDus({ ...base, maintenant: rdvMs + H })).toEqual([])
  })
  it('date illisible : rien', () => {
    expect(rappelsDus({ ...base, rdvLe: 'n\'importe quoi', maintenant: rdvMs - H })).toEqual([])
  })
})

describe('libellés', () => {
  it('heures ou jours', () => {
    expect(libelleHeuresAvant(3)).toBe('3 h avant')
    expect(libelleHeuresAvant(24)).toBe('1 jour avant')
    expect(libelleHeuresAvant(48)).toBe('2 jours avant')
  })
  it('résumé', () => {
    expect(resumeRappels([24, 3])).toBe('1 jour avant · 3 h avant')
    expect(resumeRappels([])).toBe('Aucun délai choisi')
  })
})

describe('heuresEnvoyees', () => {
  it('lit une liste, sinon rien', () => {
    expect(heuresEnvoyees([24, 3])).toEqual([24, 3])
    expect(heuresEnvoyees(null)).toEqual([])
    expect(heuresEnvoyees(undefined)).toEqual([])
  })
})

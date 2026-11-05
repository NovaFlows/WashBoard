import { describe, it, expect } from 'vitest'
import { inscriptionsParSemaine } from './resumeLaveurs'

// Jeudi 5 novembre 2026, 23h30 à Paris (22h30 UTC) : semaine du lundi 2 novembre.
const NOW = new Date('2026-11-05T22:30:00Z')

describe('inscriptionsParSemaine', () => {
  it('range par semaine du lundi, à l’heure de Paris, la plus ancienne d’abord', () => {
    const s = inscriptionsParSemaine([
      { creeLe: '2026-11-04T14:14:18Z' }, // cette semaine
      { creeLe: '2026-11-01T23:30:00Z' }, // lundi 2 à 0h30 à Paris : cette semaine
      { creeLe: '2026-11-01T12:00:00Z' }, // dimanche 1er : semaine d'avant
      { creeLe: '2026-09-01T12:00:00Z' }, // hors fenêtre
    ], NOW, 4)
    expect(s.map(x => x.debut)).toEqual(['2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02'])
    expect(s.map(x => x.nombre)).toEqual([0, 0, 1, 2])
  })
})

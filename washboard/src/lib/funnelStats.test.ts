import { describe, it, expect } from 'vitest'
import { buildFunnelSummary, type FunnelEventRow } from './funnelStats'

describe('buildFunnelSummary', () => {
  it('retourne des zéros partout sans événement', () => {
    const stats = buildFunnelSummary([])
    expect(stats.map(s => s.sessions)).toEqual([0, 0, 0, 0])
    expect(stats.map(s => s.pctOfFirst)).toEqual([0, 0, 0, 0])
  })

  it('compte les sessions distinctes, pas les événements bruts', () => {
    const events: FunnelEventRow[] = [
      { step: 'prestation', session_id: 'a' },
      { step: 'prestation', session_id: 'a' }, // même session, revenue en arrière puis repassée
      { step: 'prestation', session_id: 'b' },
    ]
    const stats = buildFunnelSummary(events)
    expect(stats.find(s => s.step === 'prestation')!.sessions).toBe(2)
  })

  it('calcule le % de la première étape et le drop-off entre étapes', () => {
    const events: FunnelEventRow[] = [
      { step: 'prestation',  session_id: 'a' },
      { step: 'prestation',  session_id: 'b' },
      { step: 'prestation',  session_id: 'c' },
      { step: 'prestation',  session_id: 'd' },
      { step: 'creneau',     session_id: 'a' },
      { step: 'creneau',     session_id: 'b' },
      { step: 'coordonnees', session_id: 'a' },
      { step: 'confirmation', session_id: 'a' },
    ]
    const stats = buildFunnelSummary(events)
    const [prestation, creneau, coordonnees, confirmation] = stats

    expect(prestation.sessions).toBe(4)
    expect(prestation.pctOfFirst).toBe(100)
    expect(prestation.pctDropFromPrevious).toBe(0)

    expect(creneau.sessions).toBe(2)
    expect(creneau.pctOfFirst).toBe(50)
    expect(creneau.pctDropFromPrevious).toBe(50)

    expect(coordonnees.sessions).toBe(1)
    expect(coordonnees.pctOfFirst).toBe(25)
    expect(coordonnees.pctDropFromPrevious).toBe(50)

    expect(confirmation.sessions).toBe(1)
    expect(confirmation.pctOfFirst).toBe(25)
    expect(confirmation.pctDropFromPrevious).toBe(0)
  })

  it("n'inclut pas l'étape options (conditionnelle) dans le tunnel principal", () => {
    const stats = buildFunnelSummary([{ step: 'options', session_id: 'a' }])
    expect(stats.map(s => s.step)).toEqual(['prestation', 'creneau', 'coordonnees', 'confirmation'])
  })

  it('ne divise jamais par zéro si une étape intermédiaire est vide puis repeuplée', () => {
    const events: FunnelEventRow[] = [
      { step: 'prestation',   session_id: 'a' },
      { step: 'confirmation', session_id: 'a' }, // saute creneau/coordonnees dans les données (ne devrait pas arriver, mais robustesse)
    ]
    expect(() => buildFunnelSummary(events)).not.toThrow()
  })
})

import { describe, it, expect } from 'vitest'
import { cleMois, plageDeMois, semainesDuMois, colonnePremierJour, compterActifsParJour, pointsRendezVous } from './vueMois'

describe('cleMois', () => {
  it('numérote les mois à partir de 1 avec un zéro devant', () => {
    expect(cleMois(2026, 8)).toBe('2026-09')
    expect(cleMois(2027, 0)).toBe('2027-01')
    expect(cleMois(2026, 11)).toBe('2026-12')
  })
})

describe('plageDeMois', () => {
  it('donne avant + 1 + après mois, dans l’ordre', () => {
    const plage = plageDeMois(new Date(2026, 8, 24), 12, 24)
    expect(plage).toHaveLength(37)
    expect(plage[0]).toEqual({ annee: 2025, mois: 8 })
    expect(plage[12]).toEqual({ annee: 2026, mois: 8 })
    expect(plage[36]).toEqual({ annee: 2028, mois: 8 })
  })

  it('franchit correctement les changements d’année, vers l’avant comme vers l’arrière', () => {
    const plage = plageDeMois(new Date(2026, 0, 15), 2, 2)
    expect(plage.map(m => cleMois(m.annee, m.mois))).toEqual(['2025-11', '2025-12', '2026-01', '2026-02', '2026-03'])
  })

  it('ne renvoie jamais deux fois le même mois', () => {
    const plage = plageDeMois(new Date(2026, 8, 24), 12, 24)
    expect(new Set(plage.map(m => cleMois(m.annee, m.mois))).size).toBe(plage.length)
  })

  it('étend la plage vers le passé pour un jour affiché hors fenêtre', () => {
    const plage = plageDeMois(new Date(2026, 8, 24), 1, 1, new Date(2025, 2, 3))
    expect(plage[0]).toEqual({ annee: 2025, mois: 2 })
    expect(plage[plage.length - 1]).toEqual({ annee: 2026, mois: 9 })
  })

  it('étend la plage vers le futur pour un jour affiché hors fenêtre', () => {
    const plage = plageDeMois(new Date(2026, 8, 24), 1, 1, new Date(2029, 0, 1))
    expect(plage[0]).toEqual({ annee: 2026, mois: 7 })
    expect(plage[plage.length - 1]).toEqual({ annee: 2029, mois: 0 })
  })

  it('ne change rien quand le jour à inclure est déjà dans la fenêtre', () => {
    expect(plageDeMois(new Date(2026, 8, 24), 3, 3, new Date(2026, 9, 5))).toEqual(plageDeMois(new Date(2026, 8, 24), 3, 3))
  })

  it('traite un nombre négatif comme zéro plutôt que de produire une plage à l’envers', () => {
    expect(plageDeMois(new Date(2026, 8, 24), -3, -1)).toEqual([{ annee: 2026, mois: 8 }])
  })
})

describe('semainesDuMois', () => {
  it('septembre 2026 (1er = mardi, 30 jours) tient en 5 semaines', () => {
    const s = semainesDuMois(2026, 8)
    expect(s).toHaveLength(5)
    s.forEach(semaine => expect(semaine).toHaveLength(7))
    expect(s[0][0]).toBeNull()
    expect(s[0][1]?.getDate()).toBe(1)
  })

  it('février 2027 (1er = lundi, 28 jours) tient en 4 semaines pleines', () => {
    const s = semainesDuMois(2027, 1)
    expect(s).toHaveLength(4)
    expect(s.flat().every(c => c !== null)).toBe(true)
  })

  it('un mois qui déborde sur 6 semaines les garde toutes (mars 2025 : 1er = samedi)', () => {
    const s = semainesDuMois(2025, 2)
    expect(s).toHaveLength(6)
    expect(s[5].some(c => c !== null)).toBe(true)
  })

  it('contient exactement chaque jour du mois une fois, dans l’ordre', () => {
    for (const [annee, mois, jours] of [[2026, 8, 30], [2028, 1, 29], [2026, 9, 31]] as const) {
      const dates = semainesDuMois(annee, mois).flat().filter((c): c is Date => c !== null)
      expect(dates.map(d => d.getDate())).toEqual(Array.from({ length: jours }, (_, i) => i + 1))
      dates.forEach(d => expect(d.getMonth()).toBe(mois))
    }
  })

  it('ne finit jamais sur une semaine entièrement vide', () => {
    for (let m = 0; m < 12; m++) {
      const s = semainesDuMois(2026, m)
      expect(s[s.length - 1].some(c => c !== null)).toBe(true)
    }
  })
})

describe('colonnePremierJour', () => {
  it('lundi = 0, dimanche = 6', () => {
    expect(colonnePremierJour(2026, 8)).toBe(1) // 1er septembre 2026 : mardi
    expect(colonnePremierJour(2027, 1)).toBe(0) // 1er février 2027 : lundi
    expect(colonnePremierJour(2026, 2)).toBe(6) // 1er mars 2026 : dimanche
  })
})

describe('compterActifsParJour', () => {
  it('ignore les rendez-vous annulés et les jours qui n’en ont plus', () => {
    const parJour = new Map([
      ['2026-8-24', [{ status: 'confirmed' }, { status: 'cancelled' }, { status: 'pending' }]],
      ['2026-8-25', [{ status: 'cancelled' }]],
      ['2026-8-26', [{ status: 'done' }]],
    ])
    const compte = compterActifsParJour(parJour)
    expect(compte.get('2026-8-24')).toBe(2)
    expect(compte.has('2026-8-25')).toBe(false)
    expect(compte.get('2026-8-26')).toBe(1)
  })

  it('renvoie une table vide quand il n’y a aucun rendez-vous', () => {
    expect(compterActifsParJour(new Map()).size).toBe(0)
  })
})

describe('pointsRendezVous', () => {
  it('un point par rendez-vous jusqu’à trois, sans plus', () => {
    expect(pointsRendezVous(0)).toEqual({ points: 0, plus: false })
    expect(pointsRendezVous(1)).toEqual({ points: 1, plus: false })
    expect(pointsRendezVous(3)).toEqual({ points: 3, plus: false })
  })

  it('au-delà de trois : trois points et un plus', () => {
    expect(pointsRendezVous(4)).toEqual({ points: 3, plus: true })
    expect(pointsRendezVous(12)).toEqual({ points: 3, plus: true })
  })

  it('accepte un autre maximum et se protège d’une valeur négative', () => {
    expect(pointsRendezVous(5, 2)).toEqual({ points: 2, plus: true })
    expect(pointsRendezVous(-2)).toEqual({ points: 0, plus: false })
  })
})

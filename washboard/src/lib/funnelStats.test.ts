import { describe, it, expect } from 'vitest'
import {
  buildFunnelSummary,
  countDistinctSessions,
  buildDeviceBreakdown,
  buildReferrerBreakdown,
  buildDeviceConversionBreakdown,
  buildReferrerConversionBreakdown,
  buildVisitTimingBreakdown,
  estimatePeakConcurrentSessions,
  comparePeriods,
  normalizeHost,
  type FunnelEventRow,
} from './funnelStats'

describe('normalizeHost', () => {
  it('extrait le host d’une URL complète', () => {
    expect(normalizeHost('https://www.kookiclean-lavage.fr/accueil')).toBe('kookiclean-lavage.fr')
  })

  it('retire le prefixe "www." dans les deux sens', () => {
    expect(normalizeHost('www.kookiclean-lavage.fr')).toBe('kookiclean-lavage.fr')
    expect(normalizeHost('kookiclean-lavage.fr')).toBe('kookiclean-lavage.fr')
  })

  it('est insensible à la casse', () => {
    expect(normalizeHost('HTTPS://WWW.KookiClean-Lavage.FR')).toBe('kookiclean-lavage.fr')
  })
})

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

describe('countDistinctSessions', () => {
  it('compte les sessions distinctes, pas les événements bruts', () => {
    expect(countDistinctSessions([
      { session_id: 'a' }, { session_id: 'a' }, { session_id: 'b' },
    ])).toBe(2)
  })

  it('retourne 0 pour une liste vide', () => {
    expect(countDistinctSessions([])).toBe(0)
  })
})

describe('buildDeviceBreakdown', () => {
  it('compte une session une seule fois, avec son premier appareil rencontré', () => {
    const stats = buildDeviceBreakdown([
      { session_id: 'a', device: 'mobile' },
      { session_id: 'a', device: 'desktop' }, // même session, 2e événement : ignoré
      { session_id: 'b', device: 'desktop' },
      { session_id: 'c', device: 'mobile' },
    ])
    const mobile = stats.find(s => s.device === 'mobile')!
    const desktop = stats.find(s => s.device === 'desktop')!
    expect(mobile.sessions).toBe(2)
    expect(mobile.pct).toBe(67)
    expect(desktop.sessions).toBe(1)
    expect(desktop.pct).toBe(33)
  })

  it('classe les sessions sans appareil connu en "inconnu" plutôt que de les ignorer', () => {
    const stats = buildDeviceBreakdown([{ session_id: 'a', device: null }, { session_id: 'b' }])
    expect(stats).toEqual([{ device: 'inconnu', sessions: 2, pct: 100 }])
  })

  it('retourne un tableau vide sans événement', () => {
    expect(buildDeviceBreakdown([])).toEqual([])
  })
})

describe('buildReferrerBreakdown', () => {
  it('regroupe les accès sans referrer sous "direct"', () => {
    const stats = buildReferrerBreakdown([
      { session_id: 'a', referrer_host: 'google.com' },
      { session_id: 'b', referrer_host: null },
      { session_id: 'c' },
    ])
    expect(stats.find(s => s.host === 'direct')!.sessions).toBe(2)
    expect(stats.find(s => s.host === 'google.com')!.sessions).toBe(1)
  })

  it('trie par nombre de sessions décroissant', () => {
    const stats = buildReferrerBreakdown([
      { session_id: 'a', referrer_host: 'instagram.com' },
      { session_id: 'b', referrer_host: 'google.com' },
      { session_id: 'c', referrer_host: 'google.com' },
    ])
    expect(stats.map(s => s.host)).toEqual(['google.com', 'instagram.com'])
  })
})

describe('buildDeviceConversionBreakdown', () => {
  it('calcule le taux de conversion par appareil', () => {
    const events = [
      { session_id: 'a', device: 'mobile' as const, step: 'prestation' as const },
      { session_id: 'a', device: 'mobile' as const, step: 'confirmation' as const },
      { session_id: 'b', device: 'mobile' as const, step: 'prestation' as const },
      { session_id: 'c', device: 'desktop' as const, step: 'prestation' as const },
      { session_id: 'c', device: 'desktop' as const, step: 'confirmation' as const },
    ]
    const stats = buildDeviceConversionBreakdown(events)
    const mobile = stats.find(s => s.device === 'mobile')!
    const desktop = stats.find(s => s.device === 'desktop')!
    expect(mobile).toEqual({ device: 'mobile', sessions: 2, conversions: 1, conversionRate: 50 })
    expect(desktop).toEqual({ device: 'desktop', sessions: 1, conversions: 1, conversionRate: 100 })
  })

  it('classe les sessions sans appareil connu en "inconnu"', () => {
    const stats = buildDeviceConversionBreakdown([{ session_id: 'a', step: 'prestation' }])
    expect(stats).toEqual([{ device: 'inconnu', sessions: 1, conversions: 0, conversionRate: 0 }])
  })

  it('retourne un tableau vide sans événement', () => {
    expect(buildDeviceConversionBreakdown([])).toEqual([])
  })
})

describe('buildReferrerConversionBreakdown', () => {
  it('calcule le taux de conversion par source de trafic', () => {
    const events = [
      { session_id: 'a', referrer_host: 'google.com', step: 'prestation' as const },
      { session_id: 'a', referrer_host: 'google.com', step: 'confirmation' as const },
      { session_id: 'b', referrer_host: 'google.com', step: 'prestation' as const },
      { session_id: 'c', referrer_host: null, step: 'prestation' as const },
    ]
    const stats = buildReferrerConversionBreakdown(events)
    const google = stats.find(s => s.host === 'google.com')!
    const direct = stats.find(s => s.host === 'direct')!
    expect(google).toEqual({ host: 'google.com', sessions: 2, conversions: 1, conversionRate: 50 })
    expect(direct).toEqual({ host: 'direct', sessions: 1, conversions: 0, conversionRate: 0 })
  })

  it('retourne un tableau vide sans événement', () => {
    expect(buildReferrerConversionBreakdown([])).toEqual([])
  })
})

describe('buildVisitTimingBreakdown', () => {
  it('retourne des listes vides et des dominants null sans événement', () => {
    const result = buildVisitTimingBreakdown([])
    expect(result.byWeekday.every(d => d.sessions === 0)).toBe(true)
    expect(result.bySlot).toEqual([])
    expect(result.topWeekday).toBeNull()
    expect(result.topSlot).toBeNull()
  })

  it('regroupe par jour de semaine (heure de Paris) et par créneau horaire', () => {
    const events = [
      // jeudi 27/08/2026, 12h Paris (10h UTC, été = UTC+2)
      { session_id: 'a', created_at: '2026-08-27T10:00:00Z' },
      { session_id: 'b', created_at: '2026-08-27T10:30:00Z' },
      // mardi 25/08/2026, 1h du matin Paris (23h30 UTC la veille)
      { session_id: 'c', created_at: '2026-08-24T23:30:00Z' },
      // jeudi 27/08/2026, 20h Paris (18h UTC, été = UTC+2) — couvre le créneau "Soir"
      { session_id: 'd', created_at: '2026-08-27T18:00:00Z' },
    ]
    const result = buildVisitTimingBreakdown(events)
    const jeudi = result.byWeekday.find(d => d.label === 'Jeudi')!
    const mardi = result.byWeekday.find(d => d.label === 'Mardi')!
    expect(jeudi.sessions).toBe(3)
    expect(mardi.sessions).toBe(1)
    expect(result.topWeekday).toBe('Jeudi')

    const apresMidi = result.bySlot.find(s => s.label === 'Après-midi (12h-18h)')!
    const nuit = result.bySlot.find(s => s.label === 'Nuit (0h-6h)')!
    const soir = result.bySlot.find(s => s.label === 'Soir (18h-0h)')!
    expect(apresMidi.sessions).toBe(2)
    expect(nuit.sessions).toBe(1)
    expect(soir.sessions).toBe(1)
    expect(result.topSlot).toBe('Après-midi (12h-18h)')
  })

  it("ne compte qu'une fois une session qui revient sur plusieurs jours (premier événement)", () => {
    const events = [
      { session_id: 'a', created_at: '2026-08-27T10:00:00Z' }, // jeudi
      { session_id: 'a', created_at: '2026-08-28T10:00:00Z' }, // vendredi, ignoré
    ]
    const result = buildVisitTimingBreakdown(events)
    expect(result.byWeekday.find(d => d.label === 'Jeudi')!.sessions).toBe(1)
    expect(result.byWeekday.find(d => d.label === 'Vendredi')!.sessions).toBe(0)
  })
})

describe('estimatePeakConcurrentSessions', () => {
  it('retourne 0 sans événement', () => {
    expect(estimatePeakConcurrentSessions([])).toBe(0)
  })

  it('compte une seule session comme un pic de 1, même avec plusieurs événements', () => {
    const events = [
      { session_id: 'a', created_at: '2026-08-27T10:00:00Z' },
      { session_id: 'a', created_at: '2026-08-27T10:05:00Z' },
    ]
    expect(estimatePeakConcurrentSessions(events)).toBe(1)
  })

  it('compte 2 sessions dont les événements tombent dans la même fenêtre d\'1h', () => {
    const events = [
      { session_id: 'a', created_at: '2026-08-27T10:00:00Z' },
      { session_id: 'b', created_at: '2026-08-27T10:30:00Z' },
    ]
    expect(estimatePeakConcurrentSessions(events)).toBe(2)
  })

  it('ne compte pas 2 sessions séparées de plus d\'1h comme simultanées', () => {
    const events = [
      { session_id: 'a', created_at: '2026-08-27T10:00:00Z' },
      { session_id: 'b', created_at: '2026-08-27T12:00:00Z' },
    ]
    expect(estimatePeakConcurrentSessions(events)).toBe(1)
  })

  it('accepte une fenêtre personnalisée', () => {
    const events = [
      { session_id: 'a', created_at: '2026-08-27T10:00:00Z' },
      { session_id: 'b', created_at: '2026-08-27T10:20:00Z' },
    ]
    expect(estimatePeakConcurrentSessions(events, 10 * 60 * 1000)).toBe(1)
  })
})

describe('comparePeriods', () => {
  it('calcule un pourcentage positif quand la période courante est plus haute', () => {
    expect(comparePeriods(10, 5)).toEqual({ pct: 100, direction: 'up' })
  })

  it('calcule un pourcentage négatif quand la période courante est plus basse', () => {
    expect(comparePeriods(5, 10)).toEqual({ pct: -50, direction: 'down' })
  })

  it('retourne "flat" à valeur égale', () => {
    expect(comparePeriods(5, 5)).toEqual({ pct: 0, direction: 'flat' })
  })

  it('ne calcule pas de pourcentage si la période précédente était à zéro', () => {
    expect(comparePeriods(3, 0)).toEqual({ pct: null, direction: 'new' })
  })

  it('reste "flat" si les deux périodes sont à zéro', () => {
    expect(comparePeriods(0, 0)).toEqual({ pct: null, direction: 'flat' })
  })
})

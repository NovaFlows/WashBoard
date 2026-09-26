import { describe, it, expect } from 'vitest'
import { couvertureEvenements, evenementsDansLaPeriode, serieVisites } from './chiffresAcquisition'
import { countDistinctSessions } from './funnelStats'
import type { PeriodeChiffres } from './chiffresPeriode'

const P = (type: PeriodeChiffres['type'], ref: string): PeriodeChiffres => ({ type, ref })
const ev = (session_id: string, created_at: string) => ({ session_id, created_at })
const somme = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

describe('evenementsDansLaPeriode', () => {
  it('borne sur minuit de Paris : 00 h 30 le 1er est dans le mois, 23 h 30 la veille aussi', () => {
    const events = [
      ev('a', '2026-08-31T21:30:00Z'), // 23 h 30 le 31 août à Paris
      ev('b', '2026-08-31T22:30:00Z'), // 00 h 30 le 1er septembre
      ev('c', '2026-09-30T21:30:00Z'), // 23 h 30 le 30 septembre
      ev('d', '2026-09-30T22:30:00Z'), // 00 h 30 le 1er octobre
    ]
    expect(evenementsDansLaPeriode(events, P('mois', '2026-09-15')).map(e => e.session_id)).toEqual(['b', 'c'])
  })

  it('ignore une date illisible', () => {
    expect(evenementsDansLaPeriode([ev('a', 'nope')], P('mois', '2026-09-15'))).toEqual([])
  })
})

describe('serieVisites', () => {
  const MAINT = Date.parse('2026-09-24T12:00:00Z')
  const events = [
    ev('s1', '2026-09-22T07:00:00Z'), ev('s1', '2026-09-22T07:05:00Z'), ev('s1', '2026-09-22T07:09:00Z'),
    ev('s2', '2026-09-22T08:00:00Z'),
    ev('s3', '2026-09-24T09:00:00Z'),
    // session qui reprend le lendemain : comptée une fois, à son premier événement
    ev('s4', '2026-09-23T10:00:00Z'), ev('s4', '2026-09-24T10:00:00Z'),
  ]

  it('une session compte une fois, au créneau de son premier événement', () => {
    const v = serieVisites(P('semaine', '2026-09-24'), events, MAINT)
    expect(v.map(p => p.visiteurs)).toEqual([0, 2, 1, 1, 0, 0, 0])
  })

  it('la somme des barres est le nombre de sessions distinctes, pour chaque type de période', () => {
    for (const type of ['jour', 'semaine', 'mois', 'annee'] as const) {
      const periode = P(type, '2026-09-22')
      const dedans = evenementsDansLaPeriode(events, periode)
      const v = serieVisites(periode, dedans, MAINT)
      expect(somme(v.map(p => p.visiteurs))).toBe(countDistinctSessions(dedans))
    }
  })

  it('mois : une barre par jour ; année : une par mois', () => {
    expect(serieVisites(P('mois', '2026-09-22'), events, MAINT)).toHaveLength(30)
    const an = serieVisites(P('annee', '2026-09-22'), events, MAINT)
    expect(an).toHaveLength(12)
    expect(an[8].visiteurs).toBe(4)
  })

  it('jour : rangé par heure de Paris', () => {
    const v = serieVisites(P('jour', '2026-09-22'), evenementsDansLaPeriode(events, P('jour', '2026-09-22')), MAINT)
    expect(v.find(p => p.cle === '09')?.visiteurs).toBe(1)
    expect(v.find(p => p.cle === '10')?.visiteurs).toBe(1)
  })

  it('marque le créneau courant et les créneaux à venir sur la période en cours', () => {
    const v = serieVisites(P('semaine', '2026-09-24'), events, MAINT)
    expect(v[3].courant).toBe(true)
    expect(v[4].futur).toBe(true)
    expect(v[2].futur).toBe(false)
  })

  it('un créneau « à venir » qui a des visites garde sa barre', () => {
    const v = serieVisites(P('semaine', '2026-09-24'), [ev('z', '2026-09-26T10:00:00Z')], MAINT)
    expect(v[5]).toMatchObject({ visiteurs: 1, futur: false })
  })

  it('aucun événement : que des zéros, pas de NaN', () => {
    const v = serieVisites(P('mois', '2026-09-22'), [], MAINT)
    expect(v.every(p => p.visiteurs === 0)).toBe(true)
  })

  it('événements hors période ou illisibles : ignorés', () => {
    const v = serieVisites(P('semaine', '2026-09-24'), [ev('x', '2025-01-01T10:00:00Z'), ev('y', 'nope')], MAINT)
    expect(somme(v.map(p => p.visiteurs))).toBe(0)
  })
})

describe('couvertureEvenements — « pas de données avant… »', () => {
  const depuis = '2025-09-24T10:00:00Z'

  it('complète : la période commence après le début de l\'historique chargé', () => {
    expect(couvertureEvenements(P('mois', '2026-09-10'), depuis).etat).toBe('complete')
  })

  it('aucune : la période finit avant le début de l\'historique', () => {
    const c = couvertureEvenements(P('mois', '2025-06-10'), depuis)
    expect(c.etat).toBe('aucune')
    expect(c.depuisJour).toBe('2025-09-24')
  })

  it('partielle : le début de l\'historique tombe dans la période (septembre 2025, année 2025)', () => {
    expect(couvertureEvenements(P('mois', '2025-09-10'), depuis).etat).toBe('partielle')
    expect(couvertureEvenements(P('annee', '2025-01-10'), depuis).etat).toBe('partielle')
  })

  it('sans borne connue : complète (rien à signaler)', () => {
    expect(couvertureEvenements(P('mois', '2020-01-10'), null).etat).toBe('complete')
    expect(couvertureEvenements(P('mois', '2020-01-10'), 'illisible').etat).toBe('complete')
  })

  it('la fenêtre commence pile à minuit de Paris : période complète', () => {
    expect(couvertureEvenements(P('mois', '2026-09-10'), '2026-08-31T22:00:00Z').etat).toBe('complete')
    expect(couvertureEvenements(P('mois', '2026-09-10'), '2026-08-31T22:00:01Z').etat).toBe('partielle')
  })
})

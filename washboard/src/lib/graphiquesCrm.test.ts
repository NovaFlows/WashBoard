import { describe, it, expect } from 'vitest'
import {
  reseauDeHote, sourcesVolumeConversion, traficDansLeTemps, caCumule, delaisDeReservation, jourParis,
} from './graphiquesCrm'

const ev = (session_id: string, step: string, created_at: string, referrer_host: string | null = null) =>
  ({ session_id, step, created_at, referrer_host })

describe('reseauDeHote', () => {
  it('regroupe les différentes formes d’un même réseau', () => {
    expect(reseauDeHote('instagram.com').cle).toBe('instagram')
    expect(reseauDeHote('l.instagram.com').cle).toBe('instagram')
    expect(reseauDeHote('www.tiktok.com').cle).toBe('tiktok')
    expect(reseauDeHote('com.google.android.googlequicksearchbox').cle).toBe('google')
  })
  it('reconnaît le site du laveur, et l’accès direct', () => {
    expect(reseauDeHote('www.kookiiclean.fr', 'kookiiclean.fr')).toEqual({ cle: 'site', label: 'Mon site web' })
    expect(reseauDeHote(null).label).toBe('Accès direct')
    expect(reseauDeHote('direct').cle).toBe('direct')
  })
  it('garde tel quel un hôte inconnu', () => {
    expect(reseauDeHote('exemple.org')).toEqual({ cle: 'exemple.org', label: 'exemple.org' })
  })
})

describe('sourcesVolumeConversion', () => {
  it('compte chaque session une fois, sous le réseau de son premier événement', () => {
    const s = sourcesVolumeConversion([
      ev('a', 'prestation', '2026-09-10T10:00:00Z', 'instagram.com'),
      ev('a', 'confirmation', '2026-09-10T10:05:00Z', 'instagram.com'),
      ev('b', 'prestation', '2026-09-10T11:00:00Z', 'l.instagram.com'),
      ev('c', 'prestation', '2026-09-10T12:00:00Z', null),
    ])
    const insta = s.find(p => p.cle === 'instagram')!
    expect(insta).toMatchObject({ visiteurs: 2, conversions: 1, taux: 50 })
    expect(s.find(p => p.cle === 'direct')).toMatchObject({ visiteurs: 1, conversions: 0, taux: 0 })
    expect(s[0].cle).toBe('instagram')
  })
})

describe('traficDansLeTemps', () => {
  const debut = new Date(2026, 8, 10)
  const fin = new Date(2026, 8, 13)

  it('donne un point par jour, jours vides compris', () => {
    const { granularite, points } = traficDansLeTemps([
      ev('a', 'prestation', '2026-09-10T10:00:00Z'),
      ev('b', 'prestation', '2026-09-10T11:00:00Z'),
      ev('b', 'confirmation', '2026-09-10T11:10:00Z'),
      ev('c', 'prestation', '2026-09-12T09:00:00Z'),
    ], debut, fin)
    expect(granularite).toBe('jour')
    expect(points.map(p => [p.cle, p.visiteurs, p.conversions])).toEqual([
      ['2026-09-10', 2, 1], ['2026-09-11', 0, 0], ['2026-09-12', 1, 0],
    ])
  })

  it('passe à la semaine au-delà de deux mois', () => {
    expect(traficDansLeTemps([], new Date(2026, 5, 1), new Date(2026, 8, 13)).granularite).toBe('semaine')
  })

  it('range une visite de 23 h 30 UTC le 10 au 11 — c’est déjà le 11 à Paris', () => {
    expect(jourParis('2026-09-10T23:30:00Z')).toBe('2026-09-11')
  })
})

describe('caCumule', () => {
  const sept = { debut: new Date(2026, 8, 1), fin: new Date(2026, 9, 1) }
  const aout = { debut: new Date(2026, 7, 1), fin: new Date(2026, 8, 1) }
  const resa = (status: string, prix: number, scheduled_at: string) => ({ status, booked_price: prix, scheduled_at })
  const points = caCumule([
    resa('done', 50, '2026-09-02T10:00:00Z'),
    resa('confirmed', 30, '2026-09-05T10:00:00Z'),
    resa('pending', 99, '2026-09-03T10:00:00Z'),
    resa('done', 20, '2026-08-03T10:00:00Z'),
  ], sept, aout, new Date(2026, 8, 6, 12).getTime(), rang => String(rang))

  it('cumule le CA réalisé, jour après jour, sans les réservations en attente', () => {
    expect(points[1].actuel).toBe(50)
    expect(points[4].actuel).toBe(80)
  })

  it('laisse vides les jours à venir de la période en cours', () => {
    expect(points[5].actuel).toBe(80)
    expect(points[6].actuel).toBeNull()
  })

  it('aligne la période précédente sur le même rang de jour, jusqu’à son dernier jour', () => {
    expect(points).toHaveLength(31)
    expect(points[2].precedent).toBe(20)
    expect(points[30]).toMatchObject({ actuel: null, precedent: 20 })
  })
})

describe('delaisDeReservation', () => {
  const b = (status: string, cree: string, planifie: string) => ({ status, created_at: cree, scheduled_at: planifie })

  it('mesure l’avance en jours, sans les annulations', () => {
    const r = delaisDeReservation([
      b('done', '2026-09-01T10:00:00Z', '2026-09-02T10:00:00Z'),
      b('pending', '2026-09-01T10:00:00Z', '2026-09-04T10:00:00Z'),
      b('confirmed', '2026-09-01T10:00:00Z', '2026-09-06T10:00:00Z'),
      b('cancelled', '2026-09-01T10:00:00Z', '2026-09-30T10:00:00Z'),
    ])
    expect(r.points.map(p => p.delai)).toEqual([1, 3, 5])
    expect(r.mediane).toBe(3)
  })

  it('prend la moyenne des deux valeurs centrales sur un nombre pair', () => {
    expect(delaisDeReservation([
      b('done', '2026-09-01T10:00:00Z', '2026-09-02T10:00:00Z'),
      b('done', '2026-09-01T10:00:00Z', '2026-09-04T10:00:00Z'),
    ]).mediane).toBe(2)
  })

  it('ne rend pas de médiane sans réservation', () => {
    expect(delaisDeReservation([]).mediane).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { clientsProches, libelleKm, positionsClients } from './proposerCreneau'

const R = (client_email: string, scheduled_at: string, lat: number | null, lng: number | null) =>
  ({ client_email, scheduled_at, lat, lng })

describe('positionsClients', () => {
  it('garde la réservation la plus récente qui a des coordonnées, clé en minuscules', () => {
    const m = positionsClients([
      R('Julie@x.fr', '2026-01-01T10:00:00Z', 48.0, 2.0),
      R('julie@x.fr', '2026-05-01T10:00:00Z', 49.0, 3.0),
      R('julie@x.fr', '2026-09-01T10:00:00Z', null, null), // plus récente mais sans position : ignorée
    ])
    expect(m.get('julie@x.fr')).toEqual({ lat: 49.0, lng: 3.0 })
    expect(m.size).toBe(1)
  })

  it('ignore les coordonnées invalides et les emails vides', () => {
    const m = positionsClients([
      R('', '2026-01-01T10:00:00Z', 48, 2),
      R('a@x.fr', '2026-01-01T10:00:00Z', Number.NaN, 2),
      R('b@x.fr', 'pas une date', 48, 2),
    ])
    expect(m.size).toBe(0)
  })
})

describe('clientsProches', () => {
  const origine = { lat: 49.0782, lng: 2.31 } // Maffliers
  const positions = new Map([
    ['pres@x.fr', { lat: 49.06, lng: 2.17 }], // Méry-sur-Oise, ~10 km
    ['tresproche@x.fr', { lat: 49.08, lng: 2.32 }], // ~1 km
    ['loin@x.fr', { lat: 48.85, lng: 2.35 }], // Paris, ~25 km
  ])
  const clients = [
    { email: 'loin@x.fr' }, { email: 'PRES@x.fr' }, { email: 'tresproche@x.fr' }, { email: 'inconnu@x.fr' },
  ]

  it('filtre à la distance choisie, du plus proche au plus loin', () => {
    const r = clientsProches(clients, positions, origine, 15)
    expect(r.proches.map(p => p.client.email)).toEqual(['tresproche@x.fr', 'PRES@x.fr'])
    expect(r.proches[0].km).toBeLessThan(2)
  })

  it('compte à part les clients sans position, sans les deviner', () => {
    expect(clientsProches(clients, positions, origine, 5).sansPosition).toBe(1)
    expect(clientsProches(clients, positions, origine, 50).proches).toHaveLength(3)
  })
})

describe('libelleKm', () => {
  it('une décimale sous 10 km, entier au-delà', () => {
    expect(libelleKm(4.23)).toBe('4,2 km')
    expect(libelleKm(12.4)).toBe('12 km')
    expect(libelleKm(0.03)).toBe('moins de 100 m')
  })
})

import { describe, it, expect } from 'vitest'
import { resumeClients } from './dashboardClients'

const DEBUT_MOIS = '2026-09-01'

describe('resumeClients', () => {
  it('compte un client une seule fois, malgré plusieurs réservations', () => {
    const r = resumeClients([
      { client_email: 'a@ex.com', created_at: '2026-08-01T10:00:00Z' },
      { client_email: 'a@ex.com', created_at: '2026-09-05T10:00:00Z' },
    ], DEBUT_MOIS)
    expect(r.total).toBe(1)
  })

  it('ignore la casse et les espaces pour identifier un même client', () => {
    const r = resumeClients([
      { client_email: ' A@Ex.com ', created_at: '2026-08-01T10:00:00Z' },
      { client_email: 'a@ex.com', created_at: '2026-09-05T10:00:00Z' },
    ], DEBUT_MOIS)
    expect(r.total).toBe(1)
  })

  it('un client est « nouveau ce mois » d’après sa PREMIÈRE réservation, pas la dernière', () => {
    // Un ancien client qui réserve à nouveau ce mois-ci n'est pas nouveau.
    const r = resumeClients([
      { client_email: 'ancien@ex.com', created_at: '2026-01-01T10:00:00Z' },
      { client_email: 'ancien@ex.com', created_at: '2026-09-10T10:00:00Z' },
    ], DEBUT_MOIS)
    expect(r.nouveauxCeMois).toBe(0)
  })

  it('compte comme nouveau un client dont la première réservation tombe ce mois-ci', () => {
    const r = resumeClients([
      { client_email: 'nouveau@ex.com', created_at: '2026-09-20T10:00:00Z' },
    ], DEBUT_MOIS)
    expect(r.nouveauxCeMois).toBe(1)
    expect(r.total).toBe(1)
  })

  it('ignore les lignes sans email', () => {
    const r = resumeClients([
      { client_email: null, created_at: '2026-09-20T10:00:00Z' },
      { client_email: '', created_at: '2026-09-20T10:00:00Z' },
    ], DEBUT_MOIS)
    expect(r.total).toBe(0)
    expect(r.nouveauxCeMois).toBe(0)
  })

  it('une liste vide donne des compteurs à zéro', () => {
    expect(resumeClients([], DEBUT_MOIS)).toEqual({ total: 0, nouveauxCeMois: 0 })
  })
})

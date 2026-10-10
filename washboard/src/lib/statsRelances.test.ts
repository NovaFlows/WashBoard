import { describe, it, expect } from 'vitest'
import { statsRelances, type ReservationRelance } from './statsRelances'

const OCTOBRE = { type: 'mois' as const, ref: '2026-10-15' }
let n = 0
const rdv = (extra: Partial<ReservationRelance>): ReservationRelance => ({
  id: `b${++n}`,
  status: 'done',
  scheduled_at: '2026-07-01T10:00:00Z',
  created_at: '2026-06-20T10:00:00Z',
  followup_sent_at: null,
  client_email: 'julie@exemple.fr',
  client_phone: '0612345678',
  ...extra,
})

describe('statsRelances', () => {
  it('compte une relance partie dans la période, et le client qui a repris rendez-vous ensuite', () => {
    const stats = statsRelances([
      rdv({ followup_sent_at: '2026-10-02T09:00:00Z' }),
      rdv({ scheduled_at: '2026-10-20T10:00:00Z', created_at: '2026-10-05T18:00:00Z', status: 'confirmed' }),
    ], OCTOBRE)
    expect(stats).toEqual({ envoyees: 1, revenus: 1 })
  })

  it('une relance sans retour compte comme envoyée, pas comme revenue', () => {
    expect(statsRelances([rdv({ followup_sent_at: '2026-10-02T09:00:00Z' })], OCTOBRE)).toEqual({ envoyees: 1, revenus: 0 })
  })

  it('ne compte pas une relance close parce que le client avait déjà repris rendez-vous', () => {
    const stats = statsRelances([
      rdv({ followup_sent_at: '2026-10-02T09:00:00Z' }),
      rdv({ scheduled_at: '2026-09-01T10:00:00Z', created_at: '2026-08-20T10:00:00Z' }),
    ], OCTOBRE)
    expect(stats.envoyees).toBe(0)
  })

  it('un retour annulé ne compte pas', () => {
    const stats = statsRelances([
      rdv({ followup_sent_at: '2026-10-02T09:00:00Z' }),
      rdv({ scheduled_at: '2026-10-20T10:00:00Z', created_at: '2026-10-05T18:00:00Z', status: 'cancelled' }),
    ], OCTOBRE)
    expect(stats).toEqual({ envoyees: 1, revenus: 0 })
  })

  it('ignore les relances hors de la période', () => {
    expect(statsRelances([rdv({ followup_sent_at: '2026-09-28T09:00:00Z' })], OCTOBRE)).toEqual({ envoyees: 0, revenus: 0 })
  })

  it('ne mélange pas deux clients, et reconnaît un client sans email par son téléphone', () => {
    const stats = statsRelances([
      rdv({ client_email: '', client_phone: '0611111111', followup_sent_at: '2026-10-02T09:00:00Z' }),
      rdv({ client_email: '', client_phone: '0622222222', scheduled_at: '2026-10-20T10:00:00Z', created_at: '2026-10-05T18:00:00Z' }),
    ], OCTOBRE)
    expect(stats).toEqual({ envoyees: 1, revenus: 0 })
  })
})

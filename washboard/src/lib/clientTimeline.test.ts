import { describe, it, expect } from 'vitest'
import { timelineClient } from './clientTimeline'
import type { ClientBooking } from './clientProfile'

const base: ClientBooking = {
  id: '1', client_name: 'Claire Martin', client_email: 'claire@x.fr', client_phone: '0600000000',
  address: '8 rue X', scheduled_at: '2026-08-12T09:00:00Z', created_at: '2026-08-01T09:00:00Z',
  status: 'done', closed_late: false, booked_price: 75, is_professional: false, company_name: null,
  services: { name: 'Lavage complet', price: 75, duration_minutes: 90 },
}
const mk = (o: Partial<ClientBooking>): ClientBooking => ({ ...base, ...o })

describe('timelineClient', () => {
  it('une prestation par rendez-vous', () => {
    const t = timelineClient([mk({ id: 'a' }), mk({ id: 'b', scheduled_at: '2026-05-30T09:00:00Z' })])
    expect(t.filter(e => e.type === 'prestation')).toHaveLength(2)
  })

  it('une demande d’avis envoyée devient un événement', () => {
    const t = timelineClient([mk({ review_request_sent_at: '2026-08-14T10:00:00Z' })])
    expect(t.find(e => e.type === 'avis')?.date).toBe('2026-08-14T10:00:00Z')
  })

  it('aucune demande d’avis sur un rendez-vous annulé : la marque ne prouve rien', () => {
    const t = timelineClient([mk({ status: 'cancelled', review_request_sent_at: '2026-08-14T10:00:00Z' })])
    expect(t.some(e => e.type === 'avis')).toBe(false)
  })

  it('aucune demande d’avis sans email : elle ne peut pas être partie', () => {
    const t = timelineClient([mk({ client_email: '', review_request_sent_at: '2026-08-14T10:00:00Z' })])
    expect(t.some(e => e.type === 'avis')).toBe(false)
  })

  it('une relance sans successeur devient un événement « partie »', () => {
    const t = timelineClient([mk({ followup_sent_at: '2026-09-03T10:00:00Z' })])
    const relance = t.find(e => e.type === 'relance')
    expect(relance).toBeDefined()
    expect(relance!.type === 'relance' && relance!.aReserveDepuis).toBe(false)
  })

  it('« a réservé depuis » quand un rendez-vous plus récent existe, créé après la marque', () => {
    const t = timelineClient([
      mk({ id: 'a', scheduled_at: '2026-08-12T09:00:00Z', followup_sent_at: '2026-09-03T10:00:00Z' }),
      mk({ id: 'b', scheduled_at: '2026-09-05T09:00:00Z', created_at: '2026-09-05T08:00:00Z', status: 'confirmed' }),
    ])
    const relance = t.find(e => e.type === 'relance')
    expect(relance!.type === 'relance' && relance!.aReserveDepuis).toBe(true)
  })

  it('une relance marquée à cause d’un rendez-vous déjà pris avant la marque n’est PAS une vraie relance partie', () => {
    // `relanceEstPartie` : la marque doit correspondre à un envoi réel, pas à une simple clôture
    // (le client était déjà revenu quand le cron est passé).
    const t = timelineClient([
      mk({ id: 'a', scheduled_at: '2026-08-12T09:00:00Z', followup_sent_at: '2026-09-03T10:00:00Z' }),
      mk({ id: 'b', scheduled_at: '2026-08-20T09:00:00Z', created_at: '2026-08-15T08:00:00Z', status: 'done' }),
    ])
    expect(t.some(e => e.type === 'relance')).toBe(false)
  })

  it('tri du plus récent au plus ancien, tous types mélangés', () => {
    const t = timelineClient([
      mk({ id: 'a', scheduled_at: '2026-05-30T09:00:00Z' }),
      mk({ id: 'b', scheduled_at: '2026-08-12T09:00:00Z', review_request_sent_at: '2026-08-14T10:00:00Z', followup_sent_at: undefined }),
    ])
    expect(t.map(e => e.date)).toEqual(['2026-08-14T10:00:00Z', '2026-08-12T09:00:00Z', '2026-05-30T09:00:00Z'])
  })

  it('aucun événement inventé : ni note ni avis chiffré, WashBoard ne les connaît pas', () => {
    const t = timelineClient([mk({ review_request_sent_at: '2026-08-14T10:00:00Z' })])
    const avis = t.find(e => e.type === 'avis')!
    expect(Object.keys(avis)).toEqual(['type', 'date'])
  })
})

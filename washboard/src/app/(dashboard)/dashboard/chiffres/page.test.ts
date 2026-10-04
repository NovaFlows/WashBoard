import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactElement } from 'react'

// « Chiffres » transmettait toutes les réservations au navigateur, verrouillées comprises :
// nom, téléphone, adresse et prix se lisaient dans le code source de la page (audit du 2026-10-02).

let bookings: Record<string, unknown>[]

// La session n'a plus aucun droit sur `bookings` (le laveur y lisait en direct ce que le masque
// cache) : son faux refuse comme Postgres. Seul le faux admin sert les réservations.
const REFUS = { data: null, error: { code: '42501', message: 'permission denied for table bookings' }, count: null }
function faux(role: 'session' | 'admin') {
  return {
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    from: (table: string) => {
      const b: Record<string, unknown> = {}
      const self = () => b
      Object.assign(b, {
        select: self, eq: self, not: self, gte: self, order: self, range: self, limit: self,
        single: () => Promise.resolve({ data: { id: 'washer-1', plan: 'starter', name: 'Kooki Clean' }, error: null }),
        then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) =>
          Promise.resolve(
            table !== 'bookings' ? { data: [], error: null }
              : role === 'admin' ? { data: bookings, error: null, count: 0 } : REFUS,
          ).then(ok, ko),
      })
      return b
    },
  }
}
const fauxSupabase = faux('session')
const fauxAdmin = faux('admin')

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => fauxSupabase }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fauxAdmin }))
vi.mock('next/navigation', () => ({ redirect: () => { throw new Error('NEXT_REDIRECT') } }))
vi.mock('@/lib/reservationsVerrouillees', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/reservationsVerrouillees')>()),
  seuilsVerrouillage: async () => [{
    debut: '2026-09-22T00:00:00.000Z', fin: '2026-10-22T00:00:00.000Z', seuil: '2026-09-25T10:00:00.000Z',
  }],
}))

const { default: ChiffresPage } = await import('./page')

const DANS_LE_QUOTA = {
  id: 'a', client_name: 'Claire Martin', client_email: 'claire@example.com', client_phone: '0611111111',
  address: '2 rue Lafayette', scheduled_at: '2026-10-01T07:00:00.000Z', status: 'done', booked_price: 50,
  created_at: '2026-09-24T08:00:00.000Z', saisie_par_laveur: false, services: { name: 'Lavage', price: 50 },
}
const AU_DELA = {
  id: 'c', client_name: 'Nadia Costa', client_email: 'nadia@example.com', client_phone: '0633333333',
  address: '1 rue de la Paix', scheduled_at: '2026-10-03T14:30:00.000Z', status: 'pending', booked_price: 40,
  created_at: '2026-09-28T09:00:00.000Z', saisie_par_laveur: false, services: { name: 'Lavage', price: 40 },
}

function reservationsTransmises(page: ReactElement): Record<string, unknown>[] {
  const chiffres = (page.props as { children: ReactElement }).children
  return (chiffres.props as { bookings: Record<string, unknown>[] }).bookings
}

beforeEach(() => {
  bookings = [DANS_LE_QUOTA, AU_DELA]
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('/dashboard/chiffres — réservations au-delà du quota', () => {
  it('ne transmet pas une réservation verrouillée au navigateur', async () => {
    const transmises = reservationsTransmises(await ChiffresPage())
    expect(transmises.map(b => b.id)).toEqual(['a'])
    const brut = JSON.stringify(transmises)
    expect(brut).not.toContain('Nadia')
    expect(brut).not.toContain('0633333333')
    expect(brut).not.toContain('rue de la Paix')
  })

  it('garde un rendez-vous saisi par le laveur, jamais soumis au quota', async () => {
    bookings = [DANS_LE_QUOTA, { ...AU_DELA, saisie_par_laveur: true }]
    const transmises = reservationsTransmises(await ChiffresPage())
    expect(transmises.map(b => b.id)).toEqual(['a', 'c'])
  })
})

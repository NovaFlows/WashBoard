import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactElement } from 'react'

// « Messages automatiques » transmettait le nom, l'email et le téléphone de toutes les
// réservations, verrouillées comprises (audit du 2026-10-02).

let bookings: Record<string, unknown>[]
let colonnesLues: string[]

// La session n'a plus aucun droit sur `bookings` (le laveur y lisait en direct ce que le masque
// cache) : son faux refuse comme Postgres. Seul le faux admin sert les réservations.
const REFUS = { data: null, error: { code: '42501', message: 'permission denied for table bookings' } }
function faux(role: 'session' | 'admin') {
  return {
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    from: (table: string) => {
      const b: Record<string, unknown> = {}
      const self = () => b
      Object.assign(b, {
        select: (colonnes: string) => { if (table === 'bookings' && role === 'admin') colonnesLues.push(colonnes); return b },
        eq: self, order: self, range: self,
        single: () => Promise.resolve({ data: { id: 'washer-1', plan: 'decouverte', name: 'Kooki Clean', slug: 'kooki' }, error: null }),
        then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) =>
          Promise.resolve(
            table !== 'bookings' ? { data: [], error: null }
              : role === 'admin' ? { data: bookings, error: null } : REFUS,
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

const { default: MessagesAutomatiquesPage } = await import('./page')

const DANS_LE_QUOTA = {
  id: 'a', client_name: 'Claire Martin', client_email: 'claire@example.com', client_phone: '0611111111',
  scheduled_at: '2026-10-01T07:00:00.000Z', status: 'done',
  created_at: '2026-09-24T08:00:00.000Z', saisie_par_laveur: false, services: { name: 'Lavage' },
}
const AU_DELA = {
  id: 'c', client_name: 'Nadia Costa', client_email: 'nadia@example.com', client_phone: '0633333333',
  scheduled_at: '2026-10-03T14:30:00.000Z', status: 'pending',
  created_at: '2026-09-28T09:00:00.000Z', saisie_par_laveur: false, services: { name: 'Lavage' },
}

function rdvsTransmis(page: ReactElement): Record<string, unknown>[] {
  const ecran = (page.props as { children: ReactElement }).children
  return (ecran.props as { rdvs: Record<string, unknown>[] }).rdvs
}

beforeEach(() => {
  bookings = [DANS_LE_QUOTA, AU_DELA]
  colonnesLues = []
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('/dashboard/clients/messages — réservations au-delà du quota', () => {
  it('ne transmet pas une réservation verrouillée au navigateur', async () => {
    const transmis = rdvsTransmis(await MessagesAutomatiquesPage())
    expect(transmis.map(b => b.id)).toEqual(['a'])
    const brut = JSON.stringify(transmis)
    expect(brut).not.toContain('Nadia')
    expect(brut).not.toContain('nadia@example.com')
    expect(brut).not.toContain('0633333333')
  })

  it('lit `saisie_par_laveur`, sans quoi un rendez-vous saisi par le laveur serait masqué', async () => {
    bookings = [DANS_LE_QUOTA, { ...AU_DELA, saisie_par_laveur: true }]
    const transmis = rdvsTransmis(await MessagesAutomatiquesPage())
    expect(transmis.map(b => b.id)).toEqual(['a', 'c'])
    expect(colonnesLues.some(c => c.includes('saisie_par_laveur'))).toBe(true)
  })
})

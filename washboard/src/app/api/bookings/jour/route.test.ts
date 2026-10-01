import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Le widget « Aujourd'hui » de l'accueil navigue de jour en jour par cette route. Elle
// renvoyait les réservations brutes : au jour suivant, le nom et l'heure d'une réservation
// au-delà du quota s'affichaient en clair, alors que l'accueil venait de les masquer.

type Plan = {
  bookings: Record<string, unknown>[]
  washer: Record<string, unknown> | null
  washerError: unknown
}
let plan: Plan

const fauxSupabase = {
  from: (table: string) => {
    const b: Record<string, unknown> = {}
    const self = () => b
    Object.assign(b, {
      select: self, eq: self, neq: self, gte: self, lt: self, order: self,
      single: () => Promise.resolve({ data: plan.washer, error: plan.washerError }),
      then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) =>
        Promise.resolve(table === 'bookings' ? { data: plan.bookings, error: null } : { data: null, error: null }).then(ok, ko),
    })
    return b
  },
}

vi.mock('@/lib/requireWasher', () => ({
  requireWasher: async () => ({ ok: true, ctx: { supabase: fauxSupabase, washerId: 'washer-1' } }),
}))

// Le seuil de la période est fixé ici ; le masque lui-même reste le vrai.
vi.mock('@/lib/reservationsVerrouillees', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/reservationsVerrouillees')>()),
  seuilsVerrouillage: async () => [{
    debut: '2026-09-22T00:00:00.000Z', fin: '2026-10-22T00:00:00.000Z', seuil: '2026-09-25T10:00:00.000Z',
  }],
}))

const { GET } = await import('./route')

const requete = () => new NextRequest('https://www.washboard.fr/api/bookings/jour?date=2026-10-03')

const DANS_LE_QUOTA = {
  id: 'a', client_name: 'Claire Martin', scheduled_at: '2026-10-03T07:00:00.000Z', status: 'confirmed',
  created_at: '2026-09-24T08:00:00.000Z', saisie_par_laveur: false, services: { name: 'Lavage' },
}
const AU_DELA = {
  id: 'c', client_name: 'Nadia Costa', scheduled_at: '2026-10-03T14:30:00.000Z', status: 'pending',
  created_at: '2026-09-28T09:00:00.000Z', saisie_par_laveur: false, services: { name: 'Lavage' },
}

beforeEach(() => {
  plan = { bookings: [DANS_LE_QUOTA, AU_DELA], washer: { id: 'washer-1', plan: 'decouverte' }, washerError: null }
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

describe('GET /api/bookings/jour — réservations au-delà du quota', () => {
  it('masque le nom et l’heure d’une réservation verrouillée, garde le jour', async () => {
    const res = await GET(requete())
    expect(res.status).toBe(200)
    const { data } = await res.json()
    const c = data.find((b: { id: string }) => b.id === 'c')
    expect(c.verrouillee).toBe(true)
    expect(c.client_name).toBeNull()
    expect(c.scheduled_at).toBe('2026-10-03T12:00:00Z')
    expect(JSON.stringify(data)).not.toContain('Nadia')
  })

  it('laisse intacte une réservation comprise dans le quota', async () => {
    const { data } = await (await GET(requete())).json()
    const a = data.find((b: { id: string }) => b.id === 'a')
    expect(a.verrouillee).toBe(false)
    expect(a.client_name).toBe('Claire Martin')
    expect(a.scheduled_at).toBe('2026-10-03T07:00:00.000Z')
  })

  it('ne renvoie rien quand l’offre du laveur est illisible, plutôt que tout en clair', async () => {
    plan.washer = null
    plan.washerError = new Error('panne')
    const res = await GET(requete())
    expect(res.status).toBeGreaterThanOrEqual(500)
    expect(JSON.stringify(await res.json())).not.toContain('Nadia')
  })
})

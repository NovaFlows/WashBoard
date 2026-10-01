import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// « Charger plus » de l'historique : le premier lot, rendu par la page, était masqué, les
// suivants arrivaient bruts — nom, téléphone et adresse d'une réservation annulée au-delà du
// quota réapparaissaient au premier clic.

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
      select: self, eq: self, in: self, order: self, range: self,
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

vi.mock('@/lib/reservationsVerrouillees', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/reservationsVerrouillees')>()),
  seuilsVerrouillage: async () => [{
    debut: '2026-09-22T00:00:00.000Z', fin: '2026-10-22T00:00:00.000Z', seuil: '2026-09-25T10:00:00.000Z',
  }],
}))

const { GET } = await import('./route')

const requete = (limite = 10) =>
  new NextRequest(`https://www.washboard.fr/api/bookings/historique?decalage=5&limite=${limite}`)

const OUVERTE = {
  id: 'a', client_name: 'Claire Martin', client_phone: '0611111111', address: '3 rue Colbert',
  status: 'done', created_at: '2026-09-24T08:00:00.000Z', saisie_par_laveur: false,
}
const VERROUILLEE = {
  id: 'c', client_name: 'Nadia Costa', client_phone: '0633333333', address: '12 rue du Parc',
  status: 'cancelled', created_at: '2026-09-28T09:00:00.000Z', saisie_par_laveur: false,
}

beforeEach(() => {
  plan = { bookings: [OUVERTE, VERROUILLEE], washer: { id: 'washer-1', plan: 'decouverte' }, washerError: null }
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

describe('GET /api/bookings/historique — réservations au-delà du quota', () => {
  it('masque nom, téléphone et adresse d’une réservation verrouillée', async () => {
    const res = await GET(requete())
    expect(res.status).toBe(200)
    const { data } = await res.json()
    const c = data.find((b: { id: string }) => b.id === 'c')
    expect(c.verrouillee).toBe(true)
    expect(c.client_name).toBeNull()
    expect(JSON.stringify(data)).not.toMatch(/Nadia|0633333333|rue du Parc/)
  })

  it('garde la ligne verrouillée dans le lot, pour que le décalage du client compte juste', async () => {
    const { data, hasMore } = await (await GET(requete(2))).json()
    expect(data).toHaveLength(2)
    expect(hasMore).toBe(true)
    expect(data.find((b: { id: string }) => b.id === 'a').client_name).toBe('Claire Martin')
  })

  it('ne renvoie rien quand l’offre du laveur est illisible, plutôt que tout en clair', async () => {
    plan.washer = null
    plan.washerError = new Error('panne')
    const res = await GET(requete())
    expect(res.status).toBeGreaterThanOrEqual(500)
    expect(JSON.stringify(await res.json())).not.toContain('Nadia')
  })
})

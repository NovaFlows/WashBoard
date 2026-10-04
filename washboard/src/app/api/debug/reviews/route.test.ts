import { describe, it, expect, vi, beforeEach } from 'vitest'

// Diagnostic des avis : un laveur connecté ne doit recevoir ni nom, ni email, ni téléphone
// pour une réservation verrouillée (au-delà du quota), même parmi ses 10 derniers RDV terminés.

const PERIODES = [{ debut: '2026-09-22T00:00:00.000Z', fin: '2026-10-22T00:00:00.000Z', seuil: '2026-09-25T10:00:00.000Z' }]

let bookings: Record<string, unknown>[]

function constructeur(table: string, options: { tableau?: Record<string, unknown>[]; unique?: unknown } = {}) {
  const b: Record<string, unknown> = {}
  const self = () => b
  Object.assign(b, {
    select: self, eq: self, order: self, limit: self, lte: self, is: self, not: self,
    single: () => Promise.resolve({ data: options.unique, error: null }),
    range: () => { b.enPagination = true; return b },
    then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) =>
      Promise.resolve({ data: b.enPagination ? [] : (options.tableau ?? []), error: null }).then(ok, ko),
  })
  return b
}

const WASHER = {
  id: 'washer-1', name: 'Kooki Clean', review_enabled: true, google_review_url: null,
  review_delay_hours: 3, review_channel: 'email', plan: 'decouverte', grandfathered: false,
  created_at: '2026-09-22T08:00:00.000Z', subscription_status: 'active', trial_ends_at: null, subscription_ends_at: null,
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    from: (table: string) => constructeur(table, { unique: WASHER }),
  }),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => constructeur(table, { tableau: table === 'bookings' ? bookings : [] }),
  }),
}))

vi.mock('@/lib/reservationsVerrouillees', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/reservationsVerrouillees')>()),
  seuilsVerrouillage: async () => PERIODES,
}))

const { GET } = await import('./route')

const DANS_LE_QUOTA = {
  id: 'a', client_name: 'Claire Martin', client_email: 'claire@example.com', client_phone: '0611111111',
  status: 'done', created_at: '2026-09-24T08:00:00.000Z', saisie_par_laveur: false, facture_numero: null,
  review_request_at: null, review_request_sent_at: null,
}
const AU_DELA = {
  id: 'c', client_name: 'Nadia Costa', client_email: 'nadia@example.com', client_phone: '0633333333',
  status: 'done', created_at: '2026-09-28T09:00:00.000Z', saisie_par_laveur: false, facture_numero: null,
  review_request_at: null, review_request_sent_at: null,
}

beforeEach(() => {
  bookings = [AU_DELA, DANS_LE_QUOTA]
})

describe('GET /api/debug/reviews', () => {
  it('ne renvoie ni nom, ni email, ni téléphone pour une réservation verrouillée', async () => {
    const res = await GET()
    const corps = JSON.stringify(await res.json())
    expect(corps).not.toContain('Nadia Costa')
    expect(corps).not.toContain('nadia@example.com')
    expect(corps).not.toContain('0633333333')
  })

  it('garde nom, email et téléphone pour une réservation dans le quota', async () => {
    const res = await GET()
    const { rdv_termines_recents } = await res.json()
    const dansQuota = rdv_termines_recents.find((r: { id: string }) => r.id === 'a')
    expect(dansQuota).toMatchObject({ client: 'Claire Martin', email: 'claire@example.com', phone: '0611111111' })
  })

  it('marque la réservation verrouillée comme telle', async () => {
    const res = await GET()
    const { rdv_termines_recents } = await res.json()
    const verrouillee = rdv_termines_recents.find((r: { id: string }) => r.id === 'c')
    expect(verrouillee).toMatchObject({ email: '🔒', phone: '🔒' })
  })
})

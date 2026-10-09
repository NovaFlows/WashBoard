import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isValidElement, type ReactElement, type ReactNode } from 'react'

// L'accueil masquait le nom d'une réservation verrouillée mais lui laissait son `scheduled_at`
// complet dans la liste transmise à BookingList : l'heure exacte se lisait dans le code source
// de la page, et la place de la carte entre ses voisines la trahissait aussi (audit du 2026-10-02).

let aVenir: Record<string, unknown>[]

// La session n'a plus aucun droit sur `bookings` (le laveur y lisait en direct ce que le masque
// cache) : son faux refuse comme Postgres. Seul le faux admin sert les réservations.
const REFUS = { data: null, error: { code: '42501', message: 'permission denied for table bookings' }, count: null }
function faux(role: 'session' | 'admin') {
  return {
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    from: (table: string) => {
      let historique = false
      const b: Record<string, unknown> = {}
      const self = () => b
      Object.assign(b, {
        select: self, eq: self, neq: self, not: self, gte: self, lte: self, lt: self, order: self, range: self, limit: self,
        in: () => { historique = true; return b },
        single: () => Promise.resolve({
          data: { id: 'washer-1', plan: 'decouverte', name: 'Kooki Clean', slug: 'kooki', created_at: '2026-01-01T00:00:00.000Z' },
          error: null,
        }),
        then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) =>
          Promise.resolve(
            table === 'bookings' && role === 'session' ? REFUS
              : table === 'bookings' && !historique ? { data: aVenir, error: null, count: 0 } : { data: [], error: null, count: 0 },
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
  compterReservationsDeLaPeriode: async () => 6,
}))

const { default: DashboardPage } = await import('./page')

const reservation = (id: string, scheduled_at: string, created_at: string, client_name: string) => ({
  id, client_name, client_email: `${id}@example.com`, client_phone: '0600000000', address: '1 rue de la Paix',
  scheduled_at, status: 'pending', booked_price: 40, created_at, saisie_par_laveur: false,
  services: { name: 'Lavage', price: 40, duration_minutes: 30 },
})

// 9 h, 10 h 30 et 11 h à Paris, le même jour. La réservation de 10 h 30 dépasse le quota.
const A = reservation('a', '2026-10-03T07:00:00.000Z', '2026-09-24T08:00:00.000Z', 'Claire Martin')
const C = reservation('c', '2026-10-03T08:30:00.000Z', '2026-09-28T09:00:00.000Z', 'Nadia Costa')
const B = reservation('b', '2026-10-03T09:00:00.000Z', '2026-09-24T09:00:00.000Z', 'Paul Durand')

/** Premier élément de l'arbre dont les props satisfont `test`, props-éléments compris. */
function trouver(noeud: ReactNode, test: (props: Record<string, unknown>) => boolean): Record<string, unknown> | null {
  if (Array.isArray(noeud)) {
    for (const n of noeud) {
      const t = trouver(n, test)
      if (t) return t
    }
    return null
  }
  if (!isValidElement(noeud)) return null
  const props = noeud.props as Record<string, unknown>
  if (test(props)) return props
  for (const valeur of Object.values(props)) {
    const t = trouver(valeur as ReactNode, test)
    if (t) return t
  }
  return null
}

beforeEach(() => {
  aVenir = [A, C, B]
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('/dashboard — heure des réservations au-delà du quota', () => {
  it('ne transmet à BookingList que le jour d’une réservation verrouillée, à midi UTC', async () => {
    const page = await DashboardPage() as ReactElement
    const liste = trouver(page, p => 'washerId' in p && Array.isArray(p.bookings))
    const transmises = liste!.bookings as Record<string, unknown>[]
    const c = transmises.find(b => b.id === 'c')!
    expect(c.verrouillee).toBe(true)
    expect(c.scheduled_at).toBe('2026-10-03T12:00:00Z')
    const brut = JSON.stringify(transmises)
    expect(brut).not.toContain('2026-10-03T08:30')
    expect(brut).not.toContain('Nadia')
  })

  it('range la carte verrouillée à midi plutôt qu’entre ses voisines', async () => {
    const page = await DashboardPage() as ReactElement
    const liste = trouver(page, p => 'washerId' in p && Array.isArray(p.bookings))
    expect((liste!.bookings as { id: string }[]).map(b => b.id)).toEqual(['a', 'b', 'c'])
  })

  it('laisse intactes les heures des réservations comprises dans le quota', async () => {
    const page = await DashboardPage() as ReactElement
    const liste = trouver(page, p => 'washerId' in p && Array.isArray(p.bookings))
    const a = (liste!.bookings as Record<string, unknown>[]).find(b => b.id === 'a')!
    expect(a.scheduled_at).toBe('2026-10-03T07:00:00.000Z')
    expect(a.client_name).toBe('Claire Martin')
  })

  it('transmet à l’accueil v2 les demandes verrouillées avec le jour seul', async () => {
    const page = await DashboardPage() as ReactElement
    const accueil = trouver(page, p => Array.isArray(p.verrouillees))
    expect(accueil!.verrouillees).toEqual([{ id: 'c', scheduled_at: '2026-10-03T12:00:00Z' }])
  })
})

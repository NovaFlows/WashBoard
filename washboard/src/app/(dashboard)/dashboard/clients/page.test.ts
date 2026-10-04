import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactElement } from 'react'

// L'annuaire reçoit les réservations avec leur heure complète : il ne doit donc recevoir
// AUCUNE réservation verrouillée (audit du 2026-10-02). Celles-ci ont leur propre liste.

let bookings: Record<string, unknown>[]

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
        select: self, eq: self, in: self, order: self, range: self, limit: self,
        single: () => Promise.resolve({ data: { id: 'washer-1', plan: 'decouverte', name: 'Kooki Clean' }, error: null }),
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
  compterReservationsDeLaPeriode: async () => 6,
}))

const { default: ClientsPage } = await import('./page')

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

beforeEach(() => {
  bookings = [AU_DELA, DANS_LE_QUOTA]
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('/dashboard/clients — annuaire', () => {
  it('ne reçoit aucune réservation verrouillée', async () => {
    const page = await ClientsPage()
    const vue = (page.props as { children: ReactElement }).children
    const annuaire = (vue.props as { bookings: Record<string, unknown>[] }).bookings
    expect(annuaire.map(b => b.id)).toEqual(['a'])
    expect(JSON.stringify(annuaire)).not.toContain('2026-10-03T14:30')
  })

  // Trouvé le 2026-10-02 : la carte « bloquée » transmettait encore l'heure complète au
  // navigateur malgré l'écran qui n'affiche que le jour — lisible au Ctrl+U. Corrigé le
  // 2026-10-04 (même règle « midi UTC » que dashboard/page.tsx).
  it('ne transmet que le jour d’une réservation verrouillée, jamais son heure', async () => {
    const page = await ClientsPage()
    const vue = (page.props as { children: ReactElement }).children
    const bloques = (vue.props as { bloques: { id: string; scheduled_at: string }[] }).bloques
    expect(bloques).toEqual([{ id: 'c', scheduled_at: '2026-10-03T12:00:00Z' }])
  })
})

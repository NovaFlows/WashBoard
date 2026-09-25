import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Disponibilités de la page de réservation, sorties du rendu serveur.
//
// Ce qui est isolable ici, et qui compte vraiment : une lecture en échec ne
// doit JAMAIS ressortir en liste vide. Le formulaire afficherait alors tous les
// créneaux libres et ignorerait les congés — double réservation et rendez-vous
// pendant les vacances, tous deux déjà vécus en production.

type Reponse = { data?: unknown; error?: unknown }

let plan: {
  bookings: Reponse
  unavailabilities: Reponse
}

/** Le builder répond à la chaîne d'appels de PostgREST ; seule la table
 *  interrogée change la réponse. */
function nouveauBuilder(table: string) {
  const reponse = () => table === 'bookings' ? plan.bookings : plan.unavailabilities
  const b: Record<string, unknown> = {}
  const chaine = () => b
  Object.assign(b, {
    select: chaine, eq: chaine, neq: chaine, gte: chaine, order: chaine,
    range: () => Promise.resolve(reponse()),
    then: (ok: (v: unknown) => unknown) => Promise.resolve(reponse()).then(ok),
  })
  return b
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: (table: string) => nouveauBuilder(table) }),
}))

const { GET } = await import('./route')

function appel(query: string) {
  return GET(new Request(`https://www.washboard.fr/api/booking-availability${query}`) as never)
}

beforeEach(() => {
  plan = {
    bookings: { data: [], error: null },
    unavailabilities: { data: [], error: null },
  }
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => { vi.restoreAllMocks() })

const ID = '11111111-2222-3333-4444-555555555555'

describe('GET /api/booking-availability', () => {
  it('refuse un identifiant absent ou mal formé', async () => {
    expect((await appel('')).status).toBe(400)
    expect((await appel('?washer_id=kookii-clean')).status).toBe(400)
  })

  it('rend les rendez-vous et les congés', async () => {
    plan.bookings = { data: [{ scheduled_at: '2026-10-01T09:00:00Z' }], error: null }
    plan.unavailabilities = { data: [{ id: 'c1', start_date: '2026-10-05', end_date: '2026-10-12' }], error: null }
    const res = await appel(`?washer_id=${ID}`)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.bookings).toHaveLength(1)
    expect(body.unavailabilities).toHaveLength(1)
  })

  it('ne met jamais ces disponibilités en cache', async () => {
    // Deux clients sur la même page doivent voir le créneau disparaître dès
    // qu'il est pris par l'un des deux.
    const res = await appel(`?washer_id=${ID}`)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('échoue plutôt que de rendre une liste vide si les rendez-vous sont illisibles', async () => {
    plan.bookings = { data: null, error: { message: 'RLS' } }
    const res = await appel(`?washer_id=${ID}`)
    expect(res.status).toBeGreaterThanOrEqual(500)
    expect(await res.json()).not.toHaveProperty('bookings')
  })

  it('échoue aussi quand ce sont les congés qui sont illisibles', async () => {
    // Un congé manquant ne se voit pas : la page propose des créneaux un jour
    // où le laveur ne travaille pas.
    plan.unavailabilities = { data: null, error: { message: 'GRANT manquant' } }
    const res = await appel(`?washer_id=${ID}`)
    expect(res.status).toBeGreaterThanOrEqual(500)
    expect(await res.json()).not.toHaveProperty('unavailabilities')
  })
})

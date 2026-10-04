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
  washer: Reponse
}

/** Le builder répond à la chaîne d'appels de PostgREST ; seule la table
 *  interrogée change la réponse. */
function nouveauBuilder(table: string) {
  const reponse = () => table === 'bookings' ? plan.bookings : table === 'washers' ? plan.washer : plan.unavailabilities
  const b: Record<string, unknown> = {}
  const chaine = () => b
  Object.assign(b, {
    select: chaine, eq: chaine, neq: chaine, gte: chaine, order: chaine,
    range: () => Promise.resolve(reponse()),
    single: () => Promise.resolve(reponse()),
    then: (ok: (v: unknown) => unknown) => Promise.resolve(reponse()).then(ok),
  })
  return b
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: (table: string) => nouveauBuilder(table) }),
}))

// Le seuil de la période est fixé ici ; le masque lui-même (estVerrouillee) reste le vrai.
vi.mock('@/lib/reservationsVerrouillees', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/reservationsVerrouillees')>()),
  seuilsVerrouillage: async () => [{
    debut: '2026-09-22T00:00:00.000Z', fin: '2026-10-22T00:00:00.000Z', seuil: '2026-09-25T10:00:00.000Z',
  }],
}))

const { GET } = await import('./route')

function appel(query: string) {
  return GET(new Request(`https://www.washboard.fr/api/booking-availability${query}`) as never)
}

const WASHER = { id: '11111111-2222-3333-4444-555555555555', plan: 'decouverte', created_at: '2026-01-01T00:00:00.000Z' }

beforeEach(() => {
  plan = {
    bookings: { data: [], error: null },
    unavailabilities: { data: [], error: null },
    washer: { data: WASHER, error: null },
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

  it('échoue plutôt que de rendre une liste en clair si le laveur est illisible', async () => {
    // Sans l'offre, impossible de savoir quel rendez-vous est verrouillé : tout
    // partirait en clair plutôt que de bloquer une journée entière.
    plan.washer = { data: null, error: { message: 'introuvable' } }
    const res = await appel(`?washer_id=${ID}`)
    expect(res.status).toBeGreaterThanOrEqual(500)
    expect(await res.json()).not.toHaveProperty('bookings')
  })
})

describe('GET /api/booking-availability — rendez-vous verrouillé par le quota', () => {
  it('cache l’heure réelle derrière un blocage de toute la journée (Europe/Paris)', async () => {
    // Créé après le seuil de la période (voir le mock de seuilsVerrouillage) : verrouillé.
    plan.bookings = {
      data: [{
        scheduled_at: '2026-10-03T14:30:00.000Z', vehicle_count: 2, selected_addons: [{ duration_minutes: 20 }],
        services: { duration_minutes: 60 }, created_at: '2026-09-26T08:00:00.000Z', saisie_par_laveur: false,
      }],
      error: null,
    }
    const res = await appel(`?washer_id=${ID}`)
    const { bookings } = await res.json()
    expect(bookings).toHaveLength(1)
    const [b] = bookings
    // Minuit à Paris le 3 octobre (heure d'été, UTC+2) → 22h UTC la veille.
    expect(b.scheduled_at).toBe('2026-10-02T22:00:00.000Z')
    expect(b.vehicle_count).toBe(1)
    expect(b.selected_addons).toEqual([])
    expect(b.services.duration_minutes).toBe(24 * 60)
    expect(JSON.stringify(b)).not.toContain('14:30')
  })

  it('laisse intact un rendez-vous dans le quota', async () => {
    plan.bookings = {
      data: [{
        scheduled_at: '2026-09-23T09:00:00.000Z', vehicle_count: 1, selected_addons: [],
        services: { duration_minutes: 60 }, created_at: '2026-09-23T08:00:00.000Z', saisie_par_laveur: false,
      }],
      error: null,
    }
    const res = await appel(`?washer_id=${ID}`)
    const { bookings } = await res.json()
    expect(bookings[0].scheduled_at).toBe('2026-09-23T09:00:00.000Z')
  })

  it('ne verrouille jamais un rendez-vous saisi par le laveur lui-même', async () => {
    plan.bookings = {
      data: [{
        scheduled_at: '2026-10-03T14:30:00.000Z', vehicle_count: 1, selected_addons: [],
        services: { duration_minutes: 60 }, created_at: '2026-09-26T08:00:00.000Z', saisie_par_laveur: true,
      }],
      error: null,
    }
    const res = await appel(`?washer_id=${ID}`)
    const { bookings } = await res.json()
    expect(bookings[0].scheduled_at).toBe('2026-10-03T14:30:00.000Z')
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Une réservation verrouillée (au-delà du quota de l'offre) ne doit pas pouvoir être modifiée
// par cette route : la réponse renvoyait la ligne complète en clair, et confirmer créait
// l'événement Google Agenda avec le vrai nom — deux fuites qui vidaient le masquage de son sens.
// Aucun écran ne mène ici pour une réservation verrouillée (BookingList affiche CarteVerrouillee,
// sans bouton d'action) : une requête qui l'atteint quand même n'a rien de légitime à y faire.

type Plan = {
  washer: Record<string, unknown> | null
  booking: Record<string, unknown> | null
  updated: Record<string, unknown> | null
}
let plan: Plan
const miseAJour = vi.fn()

const fauxSupabase = {
  auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
  from: (table: string) => {
    const b: Record<string, unknown> = {}
    const self = () => b
    Object.assign(b, {
      select: self,
      eq: self,
      update: (valeurs: Record<string, unknown>) => { miseAJour(table, valeurs); return b },
      single: () => Promise.resolve(
        table === 'washers'
          ? { data: plan.washer, error: null }
          : { data: plan.updated ?? plan.booking, error: null },
      ),
    })
    return b
  },
}

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => fauxSupabase }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fauxSupabase }))
vi.mock('@/lib/google-calendar', () => ({
  createCalendarEvent: vi.fn(), patchCalendarEvent: vi.fn(), deleteCalendarEvent: vi.fn(),
}))
vi.mock('@/lib/email', () => ({ sendBookingConfirmation: vi.fn(), sendFacture: vi.fn() }))
vi.mock('@/lib/emettreFacture', () => ({ emettreFacture: vi.fn(async () => ({ ok: false })) }))

// Le seuil de la période est fixé ici ; le masque lui-même (estVerrouillee) reste le vrai.
vi.mock('@/lib/reservationsVerrouillees', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/reservationsVerrouillees')>()),
  seuilsVerrouillage: async () => [{
    debut: '2026-09-22T00:00:00.000Z', fin: '2026-10-22T00:00:00.000Z', seuil: '2026-09-25T10:00:00.000Z',
  }],
}))

const { PATCH } = await import('./route')

function requete(body: Record<string, unknown>) {
  return new NextRequest('https://www.washboard.fr/api/bookings/c', {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}
const params = Promise.resolve({ id: 'c' })

const WASHER = { id: 'washer-1', plan: 'decouverte', created_at: '2026-01-01T00:00:00.000Z' }

beforeEach(() => {
  miseAJour.mockClear()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  plan = {
    washer: WASHER,
    booking: {
      id: 'c', washer_id: 'washer-1', status: 'pending', client_name: 'Nadia Costa',
      client_phone: '0633333333', scheduled_at: '2026-10-03T14:30:00.000Z',
      created_at: '2026-09-28T09:00:00.000Z', saisie_par_laveur: false,
      vehicle_count: 1, services: { name: 'Lavage', price: 40, duration_minutes: 30 },
    },
    updated: null,
  }
})

describe('PATCH /api/bookings/[id] — réservation verrouillée', () => {
  it('refuse de confirmer une réservation au-delà du quota, sans écrire ni renvoyer la ligne', async () => {
    const res = await PATCH(requete({ status: 'confirmed' }), { params })
    expect(res.status).toBe(403)
    expect(JSON.stringify(await res.json())).not.toContain('Nadia')
    expect(miseAJour).not.toHaveBeenCalled()
  })

  it('refuse même un simple changement de note', async () => {
    const res = await PATCH(requete({ notes: 'Prévenir avant d’arriver' }), { params })
    expect(res.status).toBe(403)
    expect(miseAJour).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/bookings/[id] — réservation dans le quota', () => {
  it('laisse passer la mise à jour', async () => {
    // Créée avant le seuil de la période : non verrouillée.
    plan.booking = { ...plan.booking, created_at: '2026-09-23T08:00:00.000Z' }
    plan.updated = { ...plan.booking, notes: 'Prévenir avant d’arriver' }
    const res = await PATCH(requete({ notes: 'Prévenir avant d’arriver' }), { params })
    expect(res.status).toBe(200)
    expect(miseAJour).toHaveBeenCalledWith('bookings', { notes: 'Prévenir avant d’arriver' })
  })
})

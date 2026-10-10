import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
let ecritures: { valeurs: Record<string, unknown>; filtres: Record<string, unknown> }[] = []
let tablesDeLaSession: string[] = []
let clientDesSeuils: unknown

// La session sert à savoir QUI écrit, rien d'autre : `authenticated` n'a plus de droit direct
// sur `bookings` (un laveur y écrivait `saisie_par_laveur` pour déverrouiller une réservation).
// Son faux refuse donc `bookings` comme Postgres ; seul le faux admin la sert.
const REFUS = { data: null, error: { code: '42501', message: 'permission denied for table bookings' } }
function faux(role: 'session' | 'admin') {
  return {
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    from: (table: string) => {
      if (role === 'session') tablesDeLaSession.push(table)
      const filtres: Record<string, unknown> = {}
      const b: Record<string, unknown> = {}
      const self = () => b
      Object.assign(b, {
        select: self,
        eq: (colonne: string, valeur: unknown) => { filtres[colonne] = valeur; return b },
        update: (valeurs: Record<string, unknown>) => {
          miseAJour(table, valeurs)
          ecritures.push({ valeurs, filtres })
          return b
        },
        single: () => Promise.resolve(
          table === 'washers' ? { data: plan.washer, error: null }
            : role === 'session' ? REFUS
              : { data: plan.updated ?? plan.booking, error: null },
        ),
      })
      return b
    },
  }
}
const fauxSupabase = faux('session')
const fauxAdmin = faux('admin')

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => fauxSupabase }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fauxAdmin }))
vi.mock('@/lib/google-calendar', () => ({
  createCalendarEvent: vi.fn(), patchCalendarEvent: vi.fn(), deleteCalendarEvent: vi.fn(),
}))
vi.mock('@/lib/email', () => ({ sendBookingConfirmation: vi.fn(), sendFacture: vi.fn() }))
vi.mock('@/lib/emettreFacture', () => ({ emettreFacture: vi.fn(async () => ({ ok: false })) }))

// Le seuil de la période est fixé ici ; le masque lui-même (estVerrouillee) reste le vrai.
vi.mock('@/lib/reservationsVerrouillees', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/reservationsVerrouillees')>()),
  seuilsVerrouillage: async (client: unknown) => {
    clientDesSeuils = client
    return [{
      debut: '2026-09-22T00:00:00.000Z', fin: '2026-10-22T00:00:00.000Z', seuil: '2026-09-25T10:00:00.000Z',
    }]
  },
}))

const { PATCH } = await import('./route')
const { createCalendarEvent, patchCalendarEvent, deleteCalendarEvent } = await import('@/lib/google-calendar')
const { sendBookingConfirmation, sendFacture } = await import('@/lib/email')
const { emettreFacture } = await import('@/lib/emettreFacture')
const { jetonValide } = await import('@/lib/bookingToken')

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
  vi.clearAllMocks()
  ecritures = []
  tablesDeLaSession = []
  clientDesSeuils = undefined
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

  it.each([
    ['un déplacement seul', { scheduled_at: '2026-10-04T09:00:00.000Z' }],
    ['une annulation', { status: 'cancelled' }],
    ['une clôture', { status: 'done' }],
    ['un corps vide', {}],
  ])('refuse %s', async (_cas, corps) => {
    const res = await PATCH(requete(corps), { params })
    expect(res.status).toBe(403)
    expect(miseAJour).not.toHaveBeenCalled()
  })

  it('ne déclenche aucun effet de bord à la confirmation', async () => {
    plan.washer = { ...WASHER, google_refresh_token: 'rt' }
    await PATCH(requete({ status: 'confirmed' }), { params })
    expect(createCalendarEvent).not.toHaveBeenCalled()
    expect(patchCalendarEvent).not.toHaveBeenCalled()
    expect(deleteCalendarEvent).not.toHaveBeenCalled()
    expect(sendBookingConfirmation).not.toHaveBeenCalled()
    expect(emettreFacture).not.toHaveBeenCalled()
    expect(sendFacture).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/bookings/[id] — réservation dans le quota', () => {
  it('laisse passer la mise à jour', async () => {
    // Après l'entrée en vigueur du plafond (2026-09-24) mais avant le seuil de la période :
    // c'est bien le seuil qui la laisse passer, pas l'antériorité au plafond.
    plan.booking = { ...plan.booking, created_at: '2026-09-24T12:00:00.000Z' }
    plan.updated = { ...plan.booking, notes: 'Prévenir avant d’arriver' }
    const res = await PATCH(requete({ notes: 'Prévenir avant d’arriver' }), { params })
    expect(res.status).toBe(200)
    expect(miseAJour).toHaveBeenCalledWith('bookings', { notes: 'Prévenir avant d’arriver' })
  })
})

describe('PATCH /api/bookings/[id] — réservation annulée', () => {
  beforeEach(() => {
    // Dans le quota : seul le statut `cancelled` doit bloquer, pas le verrouillage.
    plan.booking = { ...plan.booking, created_at: '2026-09-24T12:00:00.000Z', status: 'cancelled' }
  })

  it('refuse de la repasser à un autre statut, sans écrire ni renvoyer la ligne', async () => {
    const res = await PATCH(requete({ status: 'pending' }), { params })
    expect(res.status).toBe(409)
    expect(JSON.stringify(await res.json())).not.toContain('Nadia')
    expect(miseAJour).not.toHaveBeenCalled()
  })

  it('refuse même de la confirmer', async () => {
    const res = await PATCH(requete({ status: 'confirmed' }), { params })
    expect(res.status).toBe(409)
    expect(miseAJour).not.toHaveBeenCalled()
  })

  it('laisse passer une ré-annulation (statut inchangé)', async () => {
    plan.updated = { ...plan.booking, status: 'cancelled' }
    const res = await PATCH(requete({ status: 'cancelled' }), { params })
    expect(res.status).toBe(200)
  })
})

describe('PATCH /api/bookings/[id] — jeton du PDF dans les emails au client', () => {
  beforeEach(() => {
    vi.stubEnv('BOOKING_LINK_SECRET', 'cle-de-test-pas-un-vrai-secret')
    plan.booking = {
      ...plan.booking, created_at: '2026-09-24T12:00:00.000Z',
      client_email: 'nadia@example.com', is_professional: true,
    }
  })
  afterEach(() => { vi.unstubAllEnvs() })

  it('l’email de confirmation reçoit le jeton de cette réservation', async () => {
    vi.mocked(sendBookingConfirmation).mockResolvedValueOnce(undefined as never)
    await PATCH(requete({ status: 'confirmed' }), { params })
    const { bookingId, jeton } = vi.mocked(sendBookingConfirmation).mock.calls[0][0]
    expect(jetonValide(bookingId, jeton)).toBe(true)
  })

  it('l’email de facture reçoit le jeton de cette réservation', async () => {
    vi.mocked(emettreFacture).mockResolvedValueOnce({ ok: true, numero: 'F-2026-0007', nouvelle: true })
    vi.mocked(sendFacture).mockResolvedValueOnce(undefined as never)
    await PATCH(requete({ status: 'done' }), { params })
    const { bookingId, jeton } = vi.mocked(sendFacture).mock.calls[0][0]
    expect(jetonValide(bookingId, jeton)).toBe(true)
  })
})

describe('PATCH /api/bookings/[id] — client de lecture et d’écriture', () => {
  beforeEach(() => {
    plan.booking = { ...plan.booking, created_at: '2026-09-24T12:00:00.000Z', client_email: 'nadia@example.com' }
  })

  it('ne touche jamais `bookings` par la session, qui n’y a plus droit', async () => {
    const res = await PATCH(requete({ notes: 'x' }), { params })
    expect(res.status).toBe(200)
    expect(tablesDeLaSession).not.toContain('bookings')
    expect(clientDesSeuils).toBe(fauxAdmin)
  })

  // L'admin ignore la RLS : sans `washer_id` dans la requête, un id d'un autre laveur passerait.
  it('filtre chaque écriture sur le laveur, y compris l’id de l’événement Google Agenda', async () => {
    plan.washer = { ...WASHER, google_refresh_token: 'rt' }
    vi.mocked(createCalendarEvent).mockResolvedValueOnce('evt-1')
    vi.mocked(sendBookingConfirmation).mockResolvedValueOnce(undefined as never)
    await PATCH(requete({ status: 'confirmed' }), { params })
    expect(ecritures.map(e => e.valeurs)).toEqual([{ status: 'confirmed' }, { google_calendar_event_id: 'evt-1' }])
    for (const e of ecritures) expect(e.filtres).toMatchObject({ id: 'c', washer_id: 'washer-1' })
  })

  it('filtre aussi la programmation de la demande d’avis', async () => {
    plan.washer = { ...WASHER, review_enabled: true, google_review_url: 'https://g.page/r/x', review_delay_hours: 3 }
    await PATCH(requete({ status: 'done' }), { params })
    expect(ecritures).toHaveLength(2)
    expect(ecritures[1].valeurs).toHaveProperty('review_request_at')
    for (const e of ecritures) expect(e.filtres).toMatchObject({ id: 'c', washer_id: 'washer-1' })
  })
})

describe('PATCH /api/bookings/[id] — montant encaissé à la clôture', () => {
  beforeEach(() => {
    plan.booking = {
      ...plan.booking, created_at: '2026-09-24T12:00:00.000Z', status: 'confirmed',
      booked_price: 59, is_smart_slot: true, smart_discount: 5,
    }
  })
  const ecritureBookings = () => miseAJour.mock.calls.find(([table]) => table === 'bookings')?.[1]

  it('remplace le prix et annule la remise quand le client a payé autre chose', async () => {
    const res = await PATCH(requete({ status: 'done', montant_encaisse: '65,50' }), { params })
    expect(res.status).toBe(200)
    expect(ecritureBookings()).toEqual({ status: 'done', booked_price: 65.5, smart_discount: 0 })
  })

  it('ne touche pas au prix quand le montant est celui prévu (remise déduite)', async () => {
    await PATCH(requete({ status: 'done', montant_encaisse: 54 }), { params })
    expect(ecritureBookings()).toEqual({ status: 'done' })
  })

  it.each([['-10'], ['abc'], ['200000'], ['']])('refuse un montant invalide (%s) sans rien écrire', async montant => {
    const res = await PATCH(requete({ status: 'done', montant_encaisse: montant }), { params })
    expect(res.status).toBe(400)
    expect(miseAJour).not.toHaveBeenCalled()
  })

  it('refuse un montant hors clôture : une facture émise ne se réécrit pas', async () => {
    const res = await PATCH(requete({ notes: 'x', montant_encaisse: 10 }), { params })
    expect(res.status).toBe(400)
    plan.booking = { ...plan.booking, status: 'done' }
    const deja = await PATCH(requete({ status: 'done', montant_encaisse: 10 }), { params })
    expect(deja.status).toBe(400)
    expect(miseAJour).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/bookings/[id] — rendez-vous sans email', () => {
  it('confirme sans tenter d’envoyer d’email', async () => {
    plan.booking = { ...plan.booking, created_at: '2026-09-24T12:00:00.000Z', client_email: '' }
    const res = await PATCH(requete({ status: 'confirmed' }), { params })
    expect(res.status).toBe(200)
    expect(sendBookingConfirmation).not.toHaveBeenCalled()
  })
})

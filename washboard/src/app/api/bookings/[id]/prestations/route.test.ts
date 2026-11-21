import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// POST / DELETE /api/bookings/[id]/prestations : prestation du catalogue du laveur seulement,
// jamais sur une facture émise ni sur un rendez-vous modifié entre-temps ; email au client pour
// une réservation prise en ligne.

const C = '11111111-1111-4111-8111-111111111111'
const S2 = '22222222-2222-4222-8222-222222222222'
const S4 = '44444444-4444-4444-8444-444444444444'

let washer: Record<string, unknown> | null
let booking: Record<string, unknown> | null
let service: Record<string, unknown> | null
let ecritureAboutit: boolean
let verrouillee: boolean
let plafond: boolean
let lectures: { table: string; filtres: Record<string, unknown> }[] = []
let ecritures: { valeurs: Record<string, unknown>; filtres: Record<string, unknown> }[] = []

function faux() {
  return {
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    from: (table: string) => {
      const filtres: Record<string, unknown> = {}
      const b: Record<string, unknown> = {}
      let ecriture: Record<string, unknown> | null = null
      Object.assign(b, {
        select: () => b,
        eq: (c: string, v: unknown) => { filtres[c] = v; return b },
        is: (c: string, v: unknown) => { filtres[`${c} is`] = v; return b },
        neq: (c: string, v: unknown) => { filtres[`${c} neq`] = v; return b },
        update: (valeurs: Record<string, unknown>) => { ecriture = valeurs; ecritures.push({ valeurs, filtres }); return b },
        single: () => Promise.resolve({ data: table === 'washers' ? washer : booking, error: null }),
        maybeSingle: () => {
          if (ecriture) return Promise.resolve({ data: ecritureAboutit ? { id: C, ...ecriture } : null, error: null })
          lectures.push({ table, filtres })
          // Le filtre `washer_id` est la seule barrière entre laveurs : le faux la respecte.
          const trouve = table === 'services' && service && service.washer_id === filtres.washer_id && service.id === filtres.id
          return Promise.resolve({ data: trouve ? service : null, error: null })
        },
      })
      return b
    },
  }
}
const client = faux()
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => client }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => client }))
vi.mock('@/lib/email', () => ({ sendPrestationModifiee: vi.fn(async () => ({})) }))
vi.mock('@/lib/rateLimit', () => ({ rateLimit: () => ({ ok: !plafond, retryAfter: 0 }) }))
vi.mock('@/lib/google-calendar', () => ({ patchCalendarEvent: vi.fn(async () => {}) }))
vi.mock('@/lib/reservationsVerrouillees', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/reservationsVerrouillees')>()),
  seuilsVerrouillage: async () => [],
  estVerrouillee: () => verrouillee,
}))

const { POST, DELETE } = await import('./route')
const { sendPrestationModifiee } = await import('@/lib/email')
const { patchCalendarEvent } = await import('@/lib/google-calendar')

const requete = (methode: string, body: unknown) => new NextRequest(`https://www.washboard.fr/api/bookings/${C}/prestations`, { method: methode, body: typeof body === 'string' ? body : JSON.stringify(body) })
const params = Promise.resolve({ id: C })
const ajout = (body: unknown = { service_id: S2 }) => POST(requete('POST', body), { params })
const retrait = (body: unknown = { service_id: S2 }) => DELETE(requete('DELETE', body), { params })

const prestationAjoutee = { id: `prestation:${S2}`, label: 'Peinture 2 étriers', price: 80, category: 'prestation', duration_minutes: 60 }

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  ecritures = []
  lectures = []
  ecritureAboutit = true
  verrouillee = false
  plafond = false
  washer = { id: 'washer-1', name: 'Paint Démo', plan: 'pro', created_at: '2026-01-01T00:00:00.000Z' }
  booking = {
    id: C, washer_id: 'washer-1', service_id: S4, status: 'pending', client_name: 'Client Démo', client_email: 'client@example.com',
    scheduled_at: '2026-11-27T07:30:00.000Z', ends_at: '2026-11-27T09:30:00.000Z', created_at: '2026-11-10T09:00:00.000Z', saisie_par_laveur: false,
    booked_price: 150, is_smart_slot: false, smart_discount: 0, remise_laveur: 0, facture_numero: null, vehicle_count: 1,
    vehicles_detail: [{ type: 'voiture', count: 1, unit_price: 150, addons: [] }], selected_addons: [],
    services: { name: 'Peinture 4 étriers', price: 150, duration_minutes: 120 },
  }
  service = { id: S2, washer_id: 'washer-1', name: 'Peinture 2 étriers', price: 80, vehicle_price_overrides: {}, duration_minutes: 60, vehicle_types: ['voiture'], en_veille: false }
})

describe('POST /api/bookings/[id]/prestations', () => {
  it('ajoute la prestation, au prix du catalogue, et prévient le client', async () => {
    const res = await ajout()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toMatchObject({ booked_price: 230, ends_at: '2026-11-27T10:30:00.000Z', client_prevenu: true })
    expect(json.selected_addons).toEqual([prestationAjoutee])
    expect(ecritures).toHaveLength(1)
    // Cloisonnement entre laveurs, pas de réécriture d'une facture émise, ni d'un prix changé entre-temps.
    expect(ecritures[0].filtres).toMatchObject({ id: C, washer_id: 'washer-1', 'facture_numero is': null, booked_price: 150 })
    // Ni annulé, ni déplacé, ni d'autres prestations écrites entre la lecture et l'écriture.
    expect(ecritures[0].filtres).toMatchObject({ 'status neq': 'cancelled', scheduled_at: '2026-11-27T07:30:00.000Z', selected_addons: '[]' })
    expect(lectures).toContainEqual({ table: 'services', filtres: { id: S2, washer_id: 'washer-1' } })
    expect(sendPrestationModifiee).toHaveBeenCalledWith(expect.objectContaining({
      to: 'client@example.com', prestation: 'Peinture 2 étriers', ajout: true, ancienPrix: 150, nouveauPrix: 230,
    }))
  })

  it('ignore tout prix ou nom envoyé par le navigateur', async () => {
    const res = await ajout({ service_id: S2, price: 0, label: 'Gratuit', booked_price: 1 })
    expect(res.status).toBe(200)
    expect(ecritures[0].valeurs).toMatchObject({ booked_price: 230 })
    expect((ecritures[0].valeurs.selected_addons as { label: string }[])[0].label).toBe('Peinture 2 étriers')
  })

  it('prestation d’un autre laveur : introuvable, rien n’est écrit', async () => {
    service = { ...service, washer_id: 'washer-2' }
    const res = await ajout()
    expect(res.status).toBe(404)
    expect(ecritures).toHaveLength(0)
  })

  it('rendez-vous saisi par le laveur : aucun email', async () => {
    booking = { ...booking, saisie_par_laveur: true }
    const res = await ajout()
    expect(await res.json()).toMatchObject({ client_prevenu: false })
    expect(sendPrestationModifiee).not.toHaveBeenCalled()
  })

  describe('réservation nommée « [E2E] »', () => {
    // Vercel lance ces tests avec NODE_ENV=production : l'environnement est fixé ici.
    afterEach(() => { vi.unstubAllEnvs() })

    it('serveur de test : pas d’email réel', async () => {
      vi.stubEnv('NODE_ENV', 'test')
      booking = { ...booking, client_name: '[E2E] Test' }
      await ajout()
      expect(sendPrestationModifiee).not.toHaveBeenCalled()
    })

    it('en ligne : le client est prévenu comme les autres', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('E2E_CLEANUP_ENABLED', '')
      booking = { ...booking, client_name: '[E2E] Test' }
      await ajout()
      expect(sendPrestationModifiee).toHaveBeenCalledOnce()
    })
  })

  it('met à jour la fin de l’événement Google Agenda', async () => {
    booking = { ...booking, google_calendar_event_id: 'evt-1' }
    washer = { ...washer, google_refresh_token: 'jeton' }
    await ajout()
    expect(patchCalendarEvent).toHaveBeenCalledWith('jeton', 'evt-1', { endIso: '2026-11-27T10:30:00.000Z' })
  })

  it('emails plafonnés : la prestation est ajoutée, le client n’est pas relancé', async () => {
    plafond = true
    const res = await ajout()
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ booked_price: 230, client_prevenu: false })
    expect(sendPrestationModifiee).not.toHaveBeenCalled()
  })

  it('options nulles en base : le filtre le dit tel quel', async () => {
    booking = { ...booking, selected_addons: null }
    await ajout()
    expect(ecritures[0].filtres).toMatchObject({ 'selected_addons is': null })
  })

  it('rendez-vous modifié entre la lecture et l’écriture : 409, pas d’email', async () => {
    ecritureAboutit = false
    const res = await ajout()
    expect(res.status).toBe(409)
    expect(sendPrestationModifiee).not.toHaveBeenCalled()
  })

  it('facture émise, annulé : 409 sans écrire', async () => {
    booking = { ...booking, status: 'done', facture_numero: 'F-2026-0001' }
    expect((await ajout()).status).toBe(409)
    booking = { ...booking, status: 'cancelled', facture_numero: null }
    expect((await ajout()).status).toBe(409)
    expect(ecritures).toHaveLength(0)
  })

  it('réservation au-delà du quota : 403', async () => {
    verrouillee = true
    expect((await ajout()).status).toBe(403)
    expect(ecritures).toHaveLength(0)
  })

  it('corps invalide : 400', async () => {
    expect((await ajout({})).status).toBe(400)
    expect((await ajout({ service_id: 42 })).status).toBe(400)
    expect((await ajout({ service_id: 'x'.repeat(200) })).status).toBe(400)
    expect((await ajout({ service_id: "' or 1=1 --" })).status).toBe(400)
    expect(lectures).toHaveLength(0)
    expect((await ajout('pas du json')).status).toBe(400)
    expect(ecritures).toHaveLength(0)
  })

  it('réservation d’un autre laveur : 404', async () => {
    booking = null
    expect((await ajout()).status).toBe(404)
  })
})

describe('DELETE /api/bookings/[id]/prestations', () => {
  beforeEach(() => {
    booking = {
      ...booking, booked_price: 230, ends_at: '2026-11-27T10:30:00.000Z',
      vehicles_detail: [{ type: 'voiture', count: 1, unit_price: 150, addons: [prestationAjoutee] }],
      selected_addons: [prestationAjoutee],
    }
  })

  it('retire la prestation, sans relire le catalogue, et prévient le client', async () => {
    service = null
    const res = await retrait()
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ booked_price: 150, selected_addons: [], ends_at: '2026-11-27T09:30:00.000Z', client_prevenu: true })
    expect(sendPrestationModifiee).toHaveBeenCalledWith(expect.objectContaining({ ajout: false, prestation: 'Peinture 2 étriers', ancienPrix: 230, nouveauPrix: 150 }))
  })

  it('la prestation principale ne se retire pas', async () => {
    expect((await retrait({ service_id: S4 })).status).toBe(409)
    expect(ecritures).toHaveLength(0)
  })
})

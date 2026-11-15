import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// POST /api/bookings/[id]/remise : seulement à la baisse, jamais une fois la facture émise,
// jamais sous l'acompte ; email au client pour une réservation prise en ligne seulement.

let washer: Record<string, unknown> | null
let booking: Record<string, unknown> | null
let resultatEcriture: Record<string, unknown> | null
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
        update: (valeurs: Record<string, unknown>) => { ecriture = valeurs; ecritures.push({ valeurs, filtres }); return b },
        single: () => Promise.resolve({ data: table === 'washers' ? washer : booking, error: null }),
        maybeSingle: () => Promise.resolve({ data: ecriture ? resultatEcriture : null, error: null }),
      })
      return b
    },
  }
}
const client = faux()
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => client }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => client }))
vi.mock('@/lib/email', () => ({ sendRemiseLaveur: vi.fn(async () => ({})) }))
vi.mock('@/lib/reservationsVerrouillees', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/reservationsVerrouillees')>()),
  seuilsVerrouillage: async () => [],
}))

const { POST } = await import('./route')
const { sendRemiseLaveur } = await import('@/lib/email')

const requete = (body: unknown) => new NextRequest('https://www.washboard.fr/api/bookings/c/remise', { method: 'POST', body: JSON.stringify(body) })
const params = Promise.resolve({ id: 'c' })

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  ecritures = []
  washer = { id: 'washer-1', name: 'Démo Lavage', plan: 'pro', created_at: '2026-01-01T00:00:00.000Z' }
  booking = {
    id: 'c', washer_id: 'washer-1', status: 'confirmed', client_name: 'Client Démo', client_email: 'client@example.com',
    scheduled_at: '2026-11-20T09:00:00.000Z', created_at: '2026-11-10T09:00:00.000Z', saisie_par_laveur: false,
    booked_price: 99, is_smart_slot: false, smart_discount: 0, remise_laveur: 0, facture_numero: null,
    services: { name: 'Lavage complet', price: 99 },
  }
  resultatEcriture = { id: 'c', booked_price: 79, remise_laveur: 20 }
})

describe('POST /api/bookings/[id]/remise', () => {
  it('réservation en ligne : écrit le prix remisé, la remise, et prévient le client', async () => {
    const res = await POST(requete({ prix: 79 }), { params })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ booked_price: 79, remise_laveur: 20, client_prevenu: true })
    expect(ecritures).toHaveLength(1)
    expect(ecritures[0].valeurs).toEqual({ booked_price: 79, remise_laveur: 20 })
    // Cloisonnement entre laveurs, et pas de réécriture d'une facture émise entre-temps.
    expect(ecritures[0].filtres).toMatchObject({ id: 'c', washer_id: 'washer-1', 'facture_numero is': null })
    expect(sendRemiseLaveur).toHaveBeenCalledWith(expect.objectContaining({ to: 'client@example.com', ancienPrix: 99, nouveauPrix: 79, serviceName: 'Lavage complet' }))
  })

  it('rendez-vous saisi par le laveur : la remise est gardée, aucun email', async () => {
    booking = { ...booking, saisie_par_laveur: true }
    const res = await POST(requete({ prix: 79 }), { params })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ client_prevenu: false })
    expect(sendRemiseLaveur).not.toHaveBeenCalled()
  })

  it('client sans email : rien à envoyer', async () => {
    booking = { ...booking, client_email: '' }
    await POST(requete({ prix: 79 }), { params })
    expect(sendRemiseLaveur).not.toHaveBeenCalled()
  })

  it('refuse une hausse, sans rien écrire', async () => {
    const res = await POST(requete({ prix: 120 }), { params })
    expect(res.status).toBe(400)
    expect(ecritures).toHaveLength(0)
    expect(sendRemiseLaveur).not.toHaveBeenCalled()
  })

  it('refuse une fois la facture émise', async () => {
    booking = { ...booking, status: 'done', facture_numero: 'F-2026-0001' }
    const res = await POST(requete({ prix: 79 }), { params })
    expect(res.status).toBe(409)
    expect(ecritures).toHaveLength(0)
  })

  it('facture émise entre la lecture et l’écriture : 409, aucun email', async () => {
    resultatEcriture = null
    const res = await POST(requete({ prix: 79 }), { params })
    expect(res.status).toBe(409)
    expect(sendRemiseLaveur).not.toHaveBeenCalled()
  })

  it('refuse de descendre sous l’acompte', async () => {
    booking = { ...booking, acompte_montant: 30, acompte_statut: 'recu' }
    const res = await POST(requete({ prix: 20 }), { params })
    expect(res.status).toBe(409)
    expect(ecritures).toHaveLength(0)
  })

  it('prix manquant : 400', async () => {
    const res = await POST(requete({}), { params })
    expect(res.status).toBe(400)
  })

  it('réservation d’un autre laveur : introuvable', async () => {
    booking = null
    const res = await POST(requete({ prix: 79 }), { params })
    expect(res.status).toBe(404)
  })
})

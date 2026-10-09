import { describe, it, expect, vi, beforeEach } from 'vitest'

// Cette route (facturation manuelle, après coup) n'avait pas le même garde-fou que
// `PATCH /bookings/[id]` (qui émet la facture automatiquement au passage en « Terminé ») :
// un laveur pouvait facturer une réservation verrouillée, ce qui lui donne un accès permanent
// au PDF (exception légale « facture déjà émise ») sans jamais passer par le masquage.

type Plan = {
  booking: Record<string, unknown> | null
  washer: Record<string, unknown> | null
}
let plan: Plan

function fauxAdmin() {
  return {
    from: (table: string) => {
      const b: Record<string, unknown> = {}
      const self = () => b
      Object.assign(b, {
        select: self,
        eq: self,
        maybeSingle: () => Promise.resolve(table === 'bookings' ? { data: plan.booking, error: null } : { data: null, error: null }),
        single: () => Promise.resolve(table === 'washers' ? { data: plan.washer, error: null } : { data: null, error: null }),
      })
      return b
    },
  }
}
const fauxSupabase = {
  from: () => ({
    select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { name: 'Jean Lavage' }, error: null }) }) }),
  }),
}
const admin = fauxAdmin()

vi.mock('@/lib/requireWasher', () => ({
  requireWasher: async () => ({ ok: true, ctx: { supabase: fauxSupabase, washerId: 'washer-1' } }),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))
vi.mock('@/lib/email', () => ({ sendFacture: vi.fn(async () => undefined) }))
vi.mock('@/lib/emettreFacture', () => ({ emettreFacture: vi.fn(async () => ({ ok: true, numero: 'F-2026-0012', nouvelle: true })) }))

// Le seuil de la période est fixé ici ; le masque lui-même (estVerrouillee) reste le vrai.
vi.mock('@/lib/reservationsVerrouillees', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/reservationsVerrouillees')>()),
  seuilsVerrouillage: async () => [{
    debut: '2026-09-22T00:00:00.000Z', fin: '2026-10-22T00:00:00.000Z', seuil: '2026-09-25T10:00:00.000Z',
  }],
}))

const { POST } = await import('./route')
const { emettreFacture } = await import('@/lib/emettreFacture')
const { sendFacture } = await import('@/lib/email')

const params = Promise.resolve({ id: 'c' })
const requete = () => new Request('https://www.washboard.fr/api/bookings/c/facture', { method: 'POST' })

const WASHER = { id: 'washer-1', plan: 'decouverte', created_at: '2026-01-01T00:00:00.000Z' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  plan = {
    washer: WASHER,
    booking: {
      id: 'c', status: 'done', client_name: 'Nadia Costa', client_email: 'nadia@example.com',
      is_professional: true, created_at: '2026-09-28T09:00:00.000Z', saisie_par_laveur: false,
    },
  }
})

describe('POST /api/bookings/[id]/facture — réservation verrouillée', () => {
  it('refuse de facturer, sans appeler emettreFacture ni envoyer d’email', async () => {
    const res = await POST(requete(), { params })
    expect(res.status).toBe(403)
    expect(emettreFacture).not.toHaveBeenCalled()
    expect(sendFacture).not.toHaveBeenCalled()
  })
})

describe('POST /api/bookings/[id]/facture — réservation dans le quota', () => {
  beforeEach(() => {
    // Après l'entrée en vigueur du plafond mais avant le seuil de la période.
    plan.booking = { ...plan.booking, created_at: '2026-09-24T12:00:00.000Z' }
  })

  it('émet la facture normalement', async () => {
    const res = await POST(requete(), { params })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ numero: 'F-2026-0012' })
    expect(emettreFacture).toHaveBeenCalled()
  })

  it('envoie la facture au client professionnel', async () => {
    await POST(requete(), { params })
    expect(sendFacture).toHaveBeenCalledWith(expect.objectContaining({ to: 'nadia@example.com', numero: 'F-2026-0012' }))
  })
})

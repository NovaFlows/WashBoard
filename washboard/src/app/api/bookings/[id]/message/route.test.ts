import { describe, it, expect, vi, beforeEach } from 'vitest'

// Décaler ou annuler un message programmé depuis « Programmé » (Messages automatiques).

type Plan = { booking: Record<string, unknown> | null; washer: Record<string, unknown> | null }
let plan: Plan
let ecritures: { valeurs: Record<string, unknown>; filtres: Record<string, unknown> }[] = []

const admin = {
  from: (table: string) => {
    const filtres: Record<string, unknown> = {}
    const b: Record<string, unknown> = {}
    Object.assign(b, {
      select: () => b,
      eq: (c: string, v: unknown) => { filtres[c] = v; return b },
      update: (valeurs: Record<string, unknown>) => { ecritures.push({ valeurs, filtres }); return b },
      maybeSingle: () => Promise.resolve({ data: table === 'bookings' ? plan.booking : null, error: null }),
      single: () => Promise.resolve({ data: table === 'washers' ? plan.washer : null, error: null }),
      then: (ok: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(ok),
    })
    return b
  },
}

vi.mock('@/lib/requireWasher', () => ({
  requireWasher: async () => ({ ok: true, ctx: { supabase: {}, washerId: 'washer-1' } }),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))
vi.mock('@/lib/reservationsVerrouillees', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/reservationsVerrouillees')>()),
  seuilsVerrouillage: async () => [{
    debut: '2026-09-22T00:00:00.000Z', fin: '2026-10-22T00:00:00.000Z', seuil: '2026-09-25T10:00:00.000Z',
  }],
}))

const { PATCH } = await import('./route')
const params = Promise.resolve({ id: 'c' })
const appel = (corps: Record<string, unknown>) =>
  PATCH(new Request('https://www.washboard.fr/api/bookings/c/message', { method: 'PATCH', body: JSON.stringify(corps) }), { params })

const MAINTENANT = Date.parse('2026-10-10T10:00:00Z')
const JOUR = 86_400_000

beforeEach(() => {
  vi.useFakeTimers({ now: MAINTENANT, toFake: ['Date'] })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  ecritures = []
  plan = {
    washer: { id: 'washer-1', plan: 'pro', created_at: '2026-01-01T00:00:00.000Z', followup_delay_days: 30 },
    booking: {
      id: 'c', status: 'done', scheduled_at: '2026-09-01T10:00:00.000Z', created_at: '2026-08-20T09:00:00.000Z',
      saisie_par_laveur: true, review_request_at: '2026-10-11T10:00:00.000Z', review_request_sent_at: null,
      followup_sent_at: null, relance_reportee_au: null,
    },
  }
})

describe('PATCH /api/bookings/[id]/message', () => {
  it('décale une demande d’avis à partir de sa date prévue', async () => {
    const res = await appel({ type: 'avis', action: 'decaler', jours: 3 })
    expect(res.status).toBe(200)
    expect(ecritures).toEqual([{ valeurs: { review_request_at: '2026-10-14T10:00:00.000Z' }, filtres: { id: 'c', washer_id: 'washer-1' } }])
  })

  it('annule une demande d’avis en effaçant sa date (le cron ne lit que celles qui en ont une)', async () => {
    await appel({ type: 'avis', action: 'annuler' })
    expect(ecritures[0].valeurs).toEqual({ review_request_at: null })
  })

  it('décale une relance déjà due à partir de maintenant', async () => {
    await appel({ type: 'relance', action: 'decaler', jours: 7 })
    expect(ecritures[0].valeurs).toEqual({ relance_reportee_au: new Date(MAINTENANT + 7 * JOUR).toISOString() })
  })

  it('annule une relance : traitée pour le cron, marquée comme non partie', async () => {
    await appel({ type: 'relance', action: 'annuler' })
    const iso = new Date(MAINTENANT).toISOString()
    expect(ecritures[0].valeurs).toEqual({ followup_sent_at: iso, relance_annulee_le: iso })
  })

  it('refuse un message déjà parti', async () => {
    plan.booking = { ...plan.booking, review_request_sent_at: '2026-10-09T10:00:00.000Z', followup_sent_at: '2026-10-09T10:00:00.000Z' }
    expect((await appel({ type: 'avis', action: 'annuler' })).status).toBe(409)
    expect((await appel({ type: 'relance', action: 'annuler' })).status).toBe(409)
    expect(ecritures).toHaveLength(0)
  })

  it.each([
    [{ type: 'autre', action: 'annuler' }],
    [{ type: 'avis', action: 'supprimer' }],
    [{ type: 'avis', action: 'decaler', jours: 0 }],
    [{ type: 'avis', action: 'decaler', jours: 400 }],
    [{ type: 'avis', action: 'decaler', jours: 1.5 }],
  ])('refuse une demande invalide %j', async corps => {
    expect((await appel(corps)).status).toBe(400)
    expect(ecritures).toHaveLength(0)
  })

  it('ne trouve pas le rendez-vous d’un autre laveur', async () => {
    plan.booking = null
    expect((await appel({ type: 'avis', action: 'annuler' })).status).toBe(404)
  })

  it('refuse une réservation au-delà du quota', async () => {
    plan.washer = { ...plan.washer, plan: 'decouverte' }
    plan.booking = { ...plan.booking, saisie_par_laveur: false, created_at: '2026-09-28T09:00:00.000Z' }
    expect((await appel({ type: 'avis', action: 'annuler' })).status).toBe(403)
    expect(ecritures).toHaveLength(0)
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'

const ID = '0b7d3c2e-4f1a-4c8e-9d2b-7a6f5e4d3c2b'

const etat = vi.hoisted(() => ({
  user: { id: 'equipe-1' } as { id: string } | null,
  equipe: true,
  laveur: null as Record<string, unknown> | null,
  majs: [] as Record<string, unknown>[],
  traces: [] as Record<string, unknown>[],
  recompense: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: etat.user } }) } }),
}))
vi.mock('@/lib/supportAccess', () => ({ isSupportMember: () => etat.equipe }))
vi.mock('@/lib/parrainageServeur', () => ({ recompenserParrain: etat.recompense }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const b: Record<string, unknown> = {}
      Object.assign(b, {
        select: () => b,
        eq: () => b,
        maybeSingle: async () => ({ data: etat.laveur, error: null }),
        update: (v: Record<string, unknown>) => { etat.majs.push(v); return { eq: async () => ({ error: null }) } },
        insert: async (v: Record<string, unknown>) => { if (table === 'paiements_abonnement') etat.traces.push(v); return { error: null } },
      })
      return b
    },
  }),
}))

const { POST } = await import('./route')

function appeler(corps: unknown) {
  return POST(new Request('https://x/api', { method: 'POST', body: JSON.stringify(corps) }), { params: Promise.resolve({ id: ID }) })
}

beforeEach(() => {
  etat.user = { id: 'equipe-1' }
  etat.equipe = true
  etat.laveur = { id: ID, name: 'CleanCar 77', user_id: 'laveur-1', subscription_status: 'trial', trial_ends_at: new Date(Date.now() + 10 * 86_400_000).toISOString(), subscription_ends_at: null }
  etat.majs = []
  etat.traces = []
  etat.recompense.mockReset()
  etat.recompense.mockResolvedValue({ statut: 'recompense', parrainId: 'p', parrainNom: 'Bell Auto', forme: 'abonnement' })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

describe('POST /api/support/laveurs/[id]/paiement', () => {
  it('refuse un laveur qui n’est pas de l’équipe, sans rien écrire', async () => {
    etat.equipe = false
    const res = await appeler({ offre: 'pro', dureeMois: 1 })
    expect(res.status).toBe(401)
    expect(etat.majs).toHaveLength(0)
    expect(etat.recompense).not.toHaveBeenCalled()
  })

  it('refuse sans session', async () => {
    etat.user = null
    expect((await appeler({ offre: 'pro', dureeMois: 1 })).status).toBe(401)
  })

  it('refuse qu’un membre de l’équipe confirme son propre compte', async () => {
    etat.laveur = { ...etat.laveur!, user_id: 'equipe-1' }
    const res = await appeler({ offre: 'pro', dureeMois: 1 })
    expect(res.status).toBe(403)
    expect(etat.majs).toHaveLength(0)
  })

  it('refuse une offre gratuite ou une durée inventée', async () => {
    expect((await appeler({ offre: 'decouverte', dureeMois: 1 })).status).toBe(400)
    expect((await appeler({ offre: 'pro', dureeMois: 99 })).status).toBe(400)
  })

  it('active l’abonnement, garde une trace et donne son mois au parrain', async () => {
    const res = await appeler({ offre: 'pro', dureeMois: 1 })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(etat.majs[0]).toMatchObject({ plan: 'pro', subscription_status: 'active' })
    expect(etat.traces[0]).toMatchObject({ washer_id: ID, offre: 'pro', duree_mois: 1, confirme_par: 'equipe-1' })
    expect(etat.recompense).toHaveBeenCalledWith(expect.anything(), { id: ID, name: 'CleanCar 77' }, 'equipe')
    expect(body.parrainage).toEqual({ statut: 'recompense', parrain: 'Bell Auto', forme: 'abonnement' })
  })

  it('Starter payé pendant l’essai : garde le Pro jusqu’à la fin de l’essai', async () => {
    await appeler({ offre: 'starter', dureeMois: 1 })
    expect(etat.majs[0].pro_offert_jusqu_au).toBe(etat.laveur!.trial_ends_at)
  })

  it('dit à l’équipe quand le mois du parrain n’a pas pu être appliqué', async () => {
    etat.recompense.mockResolvedValue({ statut: 'echec' })
    const body = await (await appeler({ offre: 'pro', dureeMois: 1 })).json()
    expect(body.parrainage).toEqual({ statut: 'echec' })
  })
})

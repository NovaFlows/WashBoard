import { describe, it, expect, vi, beforeEach } from 'vitest'

const etat = vi.hoisted(() => ({
  user: { id: 'equipe-1' } as { id: string } | null,
  equipe: true,
  majs: [] as { valeurs: Record<string, unknown>; ids: unknown }[],
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: etat.user } }) } }),
}))
vi.mock('@/lib/supportAccess', () => ({ isSupportMember: () => etat.equipe }))
vi.mock('@/lib/ficheLaveurDonnees', () => ({ chargerArbreParrainages: async () => ({ racines: [], total: 0, recompenses: 0 }) }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      update: (valeurs: Record<string, unknown>) => ({
        in: async (_c: string, ids: unknown) => { etat.majs.push({ valeurs, ids }); return { error: null } },
      }),
    }),
  }),
}))

const { GET, POST } = await import('./route')
const ID = '0b7d3c2e-4f1a-4c8e-9d2b-7a6f5e4d3c2b'
const poster = (corps: unknown) => POST(new Request('https://x/api', { method: 'POST', body: JSON.stringify(corps) }))

beforeEach(() => {
  etat.user = { id: 'equipe-1' }
  etat.equipe = true
  etat.majs = []
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

describe('/api/support/parrainages', () => {
  it('réservé à l’équipe, en lecture comme en écriture', async () => {
    etat.equipe = false
    expect((await GET()).status).toBe(401)
    expect((await poster({ lignes: [ID] })).status).toBe(401)
    expect(etat.majs).toHaveLength(0)
  })

  it('« C’est normal » marque les lignes données', async () => {
    expect((await poster({ lignes: [ID] })).status).toBe(200)
    expect(etat.majs[0].ids).toEqual([ID])
    expect(etat.majs[0].valeurs).toHaveProperty('signal_ok_le')
  })

  it('ignore les identifiants mal formés', async () => {
    expect((await poster({ lignes: ['1 or 1=1'] })).status).toBe(400)
    expect(etat.majs).toHaveLength(0)
  })
})

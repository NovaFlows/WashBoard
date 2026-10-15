import { describe, it, expect, vi, beforeEach } from 'vitest'

// Ouverture en application installée. Ce qui compte : la date de première ouverture n'est
// posée qu'une fois (filtre `is null`), la dernière est réécrite à chaque fois.

let plan: { utilisateur: unknown; erreur: unknown }
const ecritures: { valeurs: Record<string, unknown>; filtres: unknown[][] }[] = []

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: plan.utilisateur } }) },
    from: () => {
      let ecriture: { valeurs: Record<string, unknown>; filtres: unknown[][] } | null = null
      const b: Record<string, unknown> = {}
      Object.assign(b, {
        update: (valeurs: Record<string, unknown>) => { ecriture = { valeurs, filtres: [] }; ecritures.push(ecriture); return b },
        eq: (...a: unknown[]) => { ecriture?.filtres.push(['eq', ...a]); return b },
        is: (...a: unknown[]) => { ecriture?.filtres.push(['is', ...a]); return b },
        then: (resoudre: (v: unknown) => void) => resoudre({ error: plan.erreur }),
      })
      return b
    },
  }),
}))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

const { POST } = await import('./route')

beforeEach(() => {
  vi.clearAllMocks()
  ecritures.length = 0
  plan = { utilisateur: { id: 'u-1' }, erreur: null }
})

describe('POST /api/washer/pwa', () => {
  it('refuse un visiteur non connecté', async () => {
    plan.utilisateur = null
    expect((await POST()).status).toBe(401)
    expect(ecritures).toHaveLength(0)
  })

  it('note la dernière ouverture, et la première seulement si elle est vide', async () => {
    expect((await POST()).status).toBe(200)
    expect(ecritures).toHaveLength(2)
    expect(ecritures[0].valeurs).toHaveProperty('pwa_derniere_ouverture_le')
    expect(ecritures[0].filtres).toContainEqual(['eq', 'user_id', 'u-1'])
    expect(ecritures[1].valeurs).toHaveProperty('pwa_installee_le')
    expect(ecritures[1].filtres).toContainEqual(['is', 'pwa_installee_le', null])
  })

  it('colonne pas encore créée : 503 sans erreur bruyante', async () => {
    plan.erreur = { code: '42703', message: 'column washers.pwa_derniere_ouverture_le does not exist' }
    expect((await POST()).status).toBe(503)
  })
})

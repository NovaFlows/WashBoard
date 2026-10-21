import { describe, it, expect, vi, beforeEach } from 'vitest'

// Dernière connexion du laveur : réécrite à chaque appel, sur sa seule fiche.

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

describe('POST /api/washer/connexion', () => {
  it('refuse un visiteur non connecté', async () => {
    plan.utilisateur = null
    expect((await POST()).status).toBe(401)
    expect(ecritures).toHaveLength(0)
  })

  it('note la dernière connexion sur la fiche du laveur connecté', async () => {
    expect((await POST()).status).toBe(200)
    expect(ecritures).toHaveLength(1)
    expect(typeof ecritures[0].valeurs.derniere_connexion_le).toBe('string')
    expect(ecritures[0].filtres).toContainEqual(['eq', 'user_id', 'u-1'])
  })

  it('colonne pas encore créée : 503 sans erreur bruyante', async () => {
    plan.erreur = { code: '42703', message: 'column washers.derniere_connexion_le does not exist' }
    expect((await POST()).status).toBe(503)
  })
})

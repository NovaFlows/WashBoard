import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Pastille « non lues » côté équipe — pendant de `support/non-lues/route.ts`.
//
// Ce qui est isolable ici : l'ordre des vérifications (authentification,
// puis appartenance à l'équipe, AVANT toute ouverture du client admin), le
// 401 (jamais un `{ count: 0 }`) pour un compte hors équipe, et le 503 sans
// repli sur une lecture en échec — le motif exact des bugs récents.

type Reponse = { data?: unknown; error?: unknown }

let plan: {
  utilisateur: { id: string; email: string | null } | null
  questions: Reponse
}

let adminOuvert = false

function nouveauBuilder() {
  const b: Record<string, unknown> = {}
  Object.assign(b, {
    select: () => Promise.resolve(plan.questions),
  })
  return b
}

const clientSession = {
  auth: { getUser: async () => ({ data: { user: plan.utilisateur } }) },
}

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => clientSession }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => {
    adminOuvert = true
    return { from: () => nouveauBuilder() }
  },
}))

const { GET } = await import('./route')

beforeEach(() => {
  vi.stubEnv('SUPPORT_ADMIN_EMAILS', 'equipe@washboard.fr')
  adminOuvert = false
  plan = {
    utilisateur: { id: 'u-equipe', email: 'equipe@washboard.fr' },
    questions: { data: [], error: null },
  }
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe('GET /api/support/non-lues-equipe', () => {
  it('refuse un visiteur non connecté, sans ouvrir le client admin', async () => {
    plan.utilisateur = null
    const res = await GET()
    expect(res.status).toBe(401)
    expect(adminOuvert).toBe(false)
  })

  it('refuse un laveur connecté qui n\'est pas de l\'équipe — 401, jamais count: 0', async () => {
    plan.utilisateur = { id: 'u-laveur', email: 'laveur@exemple.fr' }
    const res = await GET()
    const body = await res.json()
    expect(res.status).toBe(401)
    expect(body.count).toBeUndefined()
    expect(adminOuvert).toBe(false)
  })

  it('compte les messages laveur non lus par l\'équipe, toutes conversations confondues', async () => {
    plan.questions = {
      data: [
        {
          last_read_by_team_at: '2026-09-01T00:00:00.000Z',
          support_messages: [
            { author_type: 'washer', created_at: '2026-09-02T00:00:00.000Z' },
            { author_type: 'team', created_at: '2026-09-02T00:00:00.000Z' },
          ],
        },
        {
          // Curseur jamais lu par l'équipe : ne doit jamais devenir un filtre
          // qui fait disparaître des messages (piège `created_at > NULL`).
          last_read_by_team_at: null,
          support_messages: [
            { author_type: 'washer', created_at: '2026-08-01T00:00:00.000Z' },
          ],
        },
      ],
      error: null,
    }
    const res = await GET()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({ count: 2 })
  })

  it('ne compte pas un fil masqué par l\'équipe (même filtre que la liste)', async () => {
    plan.questions = {
      data: [
        {
          // Masqué après le dernier message : ne doit rien ajouter au badge,
          // même si le laveur a un message non lu par l'équipe dessus.
          last_read_by_team_at: null,
          hidden_for_team_at: '2026-09-03T00:00:00.000Z',
          last_message_at: '2026-09-02T00:00:00.000Z',
          support_messages: [
            { author_type: 'washer', created_at: '2026-09-02T00:00:00.000Z' },
          ],
        },
        {
          // Masqué puis le laveur relance : `last_message_at` avance,
          // redevient visible et doit recompter normalement.
          last_read_by_team_at: null,
          hidden_for_team_at: '2026-09-03T00:00:00.000Z',
          last_message_at: '2026-09-04T00:00:00.000Z',
          support_messages: [
            { author_type: 'washer', created_at: '2026-09-04T00:00:00.000Z' },
          ],
        },
      ],
      error: null,
    }
    const res = await GET()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({ count: 1 })
  })

  it('répond 503 sans compter 0 si la lecture échoue vraiment', async () => {
    plan.questions = { data: null, error: { message: 'base indisponible' } }
    const res = await GET()
    const body = await res.json()
    expect(res.status).toBe(503)
    expect(body.count).toBeUndefined()
  })
})

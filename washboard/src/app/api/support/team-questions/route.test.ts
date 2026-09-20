import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Boîte de réception équipe (GET) — vue par défaut (fils visibles) et vue de
// récupération `?masques=1` (fils masqués), toutes deux dérivées de la même
// fonction `isThreadHiddenForTeam` que le compteur de non-lues. Ce qui compte
// ici : les deux vues ne se recoupent jamais, un masquage accidentel reste
// retrouvable, et une lecture en échec ne se déguise jamais en liste vide.

type Reponse = { data?: unknown; error?: unknown }

let plan: {
  utilisateur: { id: string; email: string | null } | null
  questions: Reponse
}

let adminOuvert = false

function nouveauBuilder() {
  const b: Record<string, unknown> = {}
  const self = () => b
  Object.assign(b, {
    select: self,
    order: self,
    then: (ok: (v: Reponse) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(plan.questions).then(ok, ko),
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

function requete(query = '') {
  return { url: `https://www.washboard.fr/api/support/team-questions${query}` } as unknown as Parameters<typeof GET>[0]
}

const RESERVATION = { id: 'r1', name: 'Kooki Clean', slug: 'kooki-clean' }

function fil(overrides: Record<string, unknown>) {
  return {
    id: 'q1',
    subject: 'Souci',
    status: 'open',
    is_read_by_washer: true,
    is_read_by_team: false,
    last_read_by_team_at: null,
    washers: RESERVATION,
    support_messages: [],
    ...overrides,
  }
}

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

describe('GET /api/support/team-questions — authentification', () => {
  it('refuse un visiteur non connecté, sans ouvrir le client admin', async () => {
    plan.utilisateur = null
    const res = await GET(requete())
    expect(res.status).toBe(401)
    expect(adminOuvert).toBe(false)
  })

  it('refuse un compte hors équipe', async () => {
    plan.utilisateur = { id: 'u-laveur', email: 'laveur@exemple.fr' }
    const res = await GET(requete())
    expect(res.status).toBe(401)
    expect(adminOuvert).toBe(false)
  })
})

describe('GET /api/support/team-questions — vue par défaut', () => {
  it('exclut un fil masqué', async () => {
    plan.questions = {
      data: [
        fil({ id: 'visible', hidden_for_team_at: null, last_message_at: '2026-09-17T10:00:00.000Z' }),
        fil({ id: 'masque', hidden_for_team_at: '2026-09-18T00:00:00.000Z', last_message_at: '2026-09-17T10:00:00.000Z' }),
      ],
      error: null,
    }
    const res = await GET(requete())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.conversations.map((c: { id: string }) => c.id)).toEqual(['visible'])
  })

  it('un fil masqué puis relancé par le laveur redevient visible sans action de l\'équipe', async () => {
    plan.questions = {
      data: [
        fil({ id: 'relance', hidden_for_team_at: '2026-09-17T10:00:00.000Z', last_message_at: '2026-09-18T00:00:00.000Z' }),
      ],
      error: null,
    }
    const res = await GET(requete())
    const body = await res.json()
    expect(body.conversations.map((c: { id: string }) => c.id)).toEqual(['relance'])
  })
})

describe('GET /api/support/team-questions?masques=1 — récupération', () => {
  it('ne renvoie que les fils masqués, jamais les fils visibles', async () => {
    plan.questions = {
      data: [
        fil({ id: 'visible', hidden_for_team_at: null, last_message_at: '2026-09-17T10:00:00.000Z' }),
        fil({ id: 'masque', hidden_for_team_at: '2026-09-18T00:00:00.000Z', last_message_at: '2026-09-17T10:00:00.000Z' }),
      ],
      error: null,
    }
    const res = await GET(requete('?masques=1'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.conversations.map((c: { id: string }) => c.id)).toEqual(['masque'])
  })

  it('les deux vues ne se recoupent jamais, quel que soit le fil', async () => {
    const donnees = [
      fil({ id: 'a', hidden_for_team_at: null, last_message_at: '2026-09-17T10:00:00.000Z' }),
      fil({ id: 'b', hidden_for_team_at: '2026-09-18T00:00:00.000Z', last_message_at: '2026-09-17T10:00:00.000Z' }),
      fil({ id: 'c', hidden_for_team_at: '2026-09-17T00:00:00.000Z', last_message_at: '2026-09-18T00:00:00.000Z' }),
    ]
    plan.questions = { data: donnees, error: null }

    const visibles = await GET(requete()).then(r => r.json())
    const masques = await GET(requete('?masques=1')).then(r => r.json())

    const idsVisibles = visibles.conversations.map((c: { id: string }) => c.id).sort()
    const idsMasques = masques.conversations.map((c: { id: string }) => c.id).sort()
    expect(idsVisibles).toEqual(['a', 'c'])
    expect(idsMasques).toEqual(['b'])
    // Aucun id en commun entre les deux vues.
    expect(idsVisibles.filter((id: string) => idsMasques.includes(id))).toHaveLength(0)
  })

  it('vide plutôt que tout si aucun fil n\'est masqué', async () => {
    plan.questions = {
      data: [fil({ id: 'visible', hidden_for_team_at: null, last_message_at: '2026-09-17T10:00:00.000Z' })],
      error: null,
    }
    const res = await GET(requete('?masques=1'))
    const body = await res.json()
    expect(body.conversations).toEqual([])
  })
})

describe('GET /api/support/team-questions — échec de lecture', () => {
  it('répond 503 sans se déguiser en liste vide, sur les deux vues', async () => {
    plan.questions = { data: null, error: { message: 'base indisponible' } }
    expect((await GET(requete())).status).toBe(503)
    expect((await GET(requete('?masques=1'))).status).toBe(503)
  })
})

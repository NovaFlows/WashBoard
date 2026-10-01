import { describe, it, expect, vi, beforeEach } from 'vitest'

// Fin de l'onboarding. Ce qui compte : seule une réponse de la liste passe,
// l'onboarding n'est marqué terminé qu'une fois, et une écriture écartée en
// silence (RLS) se voit au lieu de faire revenir l'écran à chaque connexion.

type Reponse = { data?: unknown; error?: unknown }

let plan: { utilisateur: unknown; miseAJour: Reponse; relecture: Reponse }
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
        select: () => (ecriture ? Promise.resolve(plan.miseAJour) : b),
        maybeSingle: async () => plan.relecture,
      })
      return b
    },
  }),
}))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

const { POST } = await import('./route')
const { logger } = await import('@/lib/logger')

async function envoyer(corps: unknown) {
  const { NextRequest } = await import('next/server')
  const res = await POST(new NextRequest('https://www.washboard.fr/api/washer/onboarding', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof corps === 'string' ? corps : JSON.stringify(corps),
  }))
  return { status: res.status, body: await res.json() }
}

beforeEach(() => {
  vi.clearAllMocks()
  ecritures.length = 0
  plan = {
    utilisateur: { id: 'u-1' },
    miseAJour: { data: [{ id: 'w-1' }], error: null },
    relecture: { data: null, error: null },
  }
})

describe('POST /api/washer/onboarding', () => {
  it('refuse un visiteur non connecté', async () => {
    plan.utilisateur = null
    expect((await envoyer({ acquisition_source: 'google' })).status).toBe(401)
    expect(ecritures).toHaveLength(0)
  })

  it('refuse une réponse hors liste ou un corps illisible', async () => {
    for (const corps of [{ acquisition_source: 'facebook' }, {}, { acquisition_source: 'Google' }, 'pas du json']) {
      expect((await envoyer(corps)).status).toBe(400)
    }
    expect(ecritures).toHaveLength(0)
  })

  it('enregistre la source et marque l’onboarding terminé, une seule fois', async () => {
    const { status } = await envoyer({ acquisition_source: 'instagram' })
    expect(status).toBe(200)
    expect(ecritures).toHaveLength(1)
    expect(ecritures[0].valeurs.acquisition_source).toBe('instagram')
    expect(typeof ecritures[0].valeurs.onboarding_complete_at).toBe('string')
    expect(ecritures[0].filtres).toContainEqual(['eq', 'user_id', 'u-1'])
    expect(ecritures[0].filtres).toContainEqual(['is', 'onboarding_complete_at', null])
  })

  it('déjà terminé (double envoi) : succès sans rien réécrire', async () => {
    plan.miseAJour = { data: [], error: null }
    plan.relecture = { data: { onboarding_complete_at: '2026-10-01T08:00:00Z' }, error: null }
    expect((await envoyer({ acquisition_source: 'tiktok' })).status).toBe(200)
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('aucune ligne écrite et onboarding toujours ouvert : erreur tracée avec errorId', async () => {
    plan.miseAJour = { data: [], error: null }
    plan.relecture = { data: { onboarding_complete_at: null }, error: null }
    const { status, body } = await envoyer({ acquisition_source: 'google' })
    expect(status).toBe(500)
    expect(body.errorId).toEqual(expect.any(String))
    expect(logger.error).toHaveBeenCalledWith('washer.onboarding.non_enregistre', expect.objectContaining({ userId: 'u-1' }), expect.anything())
  })

  it('écriture refusée par la base : erreur tracée avec errorId', async () => {
    plan.miseAJour = { data: null, error: { code: '42501', message: 'permission denied' } }
    const { status, body } = await envoyer({ acquisition_source: 'autre' })
    expect(status).toBe(500)
    expect(body.errorId).toEqual(expect.any(String))
    expect(logger.error).toHaveBeenCalledWith('washer.onboarding.db', expect.objectContaining({ userId: 'u-1' }), expect.anything())
  })
})

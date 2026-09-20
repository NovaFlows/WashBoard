import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// PATCH /api/support/team-questions/[id] — masquage réversible d'un fil dans
// la boîte de réception équipe (bouton/glissement), en plus du statut et du
// marquage lu déjà en place.
//
// Ce qui est isolable ici, sans base de données : `hidden_for_team_at` n'est
// JAMAIS accepté depuis le corps de la requête (seul un booléen `hidden`
// l'est, la date est calculée côté serveur), démasquer remet bien à `NULL`
// (jamais une date passée), et un échec d'écriture est tracé et renvoyé
// plutôt qu'avalé — `designer` doit pouvoir remettre l'élément dans la liste.

type Reponse = { data?: unknown; error?: unknown }

let plan: {
  utilisateur: { id: string; email: string | null } | null
  updateError: unknown
}

const updates: Record<string, unknown>[] = []
let adminOuvert = false

function nouveauBuilder() {
  const b: Record<string, unknown> = {}
  Object.assign(b, {
    update: (valeurs: Record<string, unknown>) => {
      updates.push(valeurs)
      return { eq: () => Promise.resolve({ error: plan.updateError } as Reponse) }
    },
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

const { PATCH } = await import('./route')

function requete(body: Record<string, unknown>) {
  return new Request('https://www.washboard.fr/api/support/team-questions/q1', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof PATCH>[0]
}

async function patch(body: Record<string, unknown>) {
  const res = await PATCH(requete(body), { params: Promise.resolve({ id: 'q1' }) })
  return { res, body: await res.json() }
}

beforeEach(() => {
  vi.stubEnv('SUPPORT_ADMIN_EMAILS', 'equipe@washboard.fr')
  updates.length = 0
  adminOuvert = false
  plan = {
    utilisateur: { id: 'u-equipe', email: 'equipe@washboard.fr' },
    updateError: null,
  }
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe('PATCH /api/support/team-questions/[id] — authentification', () => {
  it('refuse un visiteur non connecté, sans ouvrir le client admin', async () => {
    plan.utilisateur = null
    const { res } = await patch({ hidden: true })
    expect(res.status).toBe(401)
    expect(adminOuvert).toBe(false)
  })

  it('refuse un compte hors équipe', async () => {
    plan.utilisateur = { id: 'u-laveur', email: 'laveur@exemple.fr' }
    const { res } = await patch({ hidden: true })
    expect(res.status).toBe(401)
    expect(adminOuvert).toBe(false)
  })
})

describe('PATCH /api/support/team-questions/[id] — masquage', () => {
  it('masquer pose une date calculée côté serveur, jamais celle du corps de la requête', async () => {
    const avant = Date.now()
    const { res, body } = await patch({ hidden: true, hidden_for_team_at: '2020-01-01T00:00:00.000Z' })
    expect(res.status).toBe(200)
    expect(body).toEqual({ success: true })
    expect(updates).toHaveLength(1)
    const valeur = updates[0].hidden_for_team_at as string
    expect(valeur).not.toBe('2020-01-01T00:00:00.000Z')
    expect(new Date(valeur).getTime()).toBeGreaterThanOrEqual(avant)
  })

  it('démasquer remet la colonne à NULL, jamais à une date passée', async () => {
    const { res } = await patch({ hidden: false })
    expect(res.status).toBe(200)
    expect(updates[0].hidden_for_team_at).toBeNull()
  })

  it('un `hidden` absent ne touche pas la colonne', async () => {
    const { res } = await patch({ status: 'resolue' })
    expect(res.status).toBe(200)
    expect(updates[0]).not.toHaveProperty('hidden_for_team_at')
  })

  it('peut se combiner avec un changement de statut dans le même appel', async () => {
    const { res } = await patch({ hidden: true, status: 'resolue' })
    expect(res.status).toBe(200)
    expect(updates[0].status).toBe('resolved')
    expect(updates[0]).toHaveProperty('hidden_for_team_at')
  })

  it('une valeur `hidden` invalide est ignorée plutôt qu\'interprétée', async () => {
    const { res, body } = await patch({ hidden: 'oui' })
    expect(res.status).toBe(400)
    expect(body.error).toBeTruthy()
    expect(updates).toHaveLength(0)
  })

  it('remonte un échec d\'écriture plutôt que de le confirmer à tort', async () => {
    // Le motif des bugs récents : `designer` doit pouvoir remettre le fil
    // dans la liste si ce masquage échoue réellement en base.
    plan.updateError = { message: 'base indisponible' }
    const { res, body } = await patch({ hidden: true })
    expect(res.status).toBe(503)
    expect(body.error).toBeTruthy()
    expect(body.success).toBeUndefined()
  })
})

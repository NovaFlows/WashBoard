import { describe, it, expect, vi, beforeEach } from 'vitest'

// Disponibilité d'un lien pendant l'onboarding. Ce qui compte : la question
// passe par le client admin (la session ne voit que sa propre fiche), et une
// lecture ratée n'est jamais répondue « disponible ».

type Reponse = { data?: unknown; error?: unknown }

let plan: { utilisateur: unknown; proprietaire: Reponse }
const slugsLus: unknown[] = []

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: plan.utilisateur } }) } }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => {
      const b: Record<string, unknown> = {}
      Object.assign(b, {
        select: () => b,
        eq: (_col: string, v: unknown) => { slugsLus.push(v); return b },
        maybeSingle: async () => plan.proprietaire,
      })
      return b
    },
  }),
}))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

const { GET } = await import('./route')
const { logger } = await import('@/lib/logger')

async function demander(slug: string) {
  const { NextRequest } = await import('next/server')
  const res = await GET(new NextRequest(`https://www.washboard.fr/api/washer/slug?slug=${encodeURIComponent(slug)}`))
  return { status: res.status, body: await res.json() }
}

beforeEach(() => {
  vi.clearAllMocks()
  slugsLus.length = 0
  plan = { utilisateur: { id: 'u-1' }, proprietaire: { data: null, error: null } }
})

describe('GET /api/washer/slug', () => {
  it('refuse un visiteur non connecté', async () => {
    plan.utilisateur = null
    expect((await demander('kooki-clean')).status).toBe(401)
    expect(slugsLus).toHaveLength(0)
  })

  it('refuse un format invalide sans interroger la base', async () => {
    for (const mauvais of ['ab', '-abc', 'société', 'a'.repeat(41)]) {
      expect((await demander(mauvais)).status, mauvais).toBe(400)
    }
    expect(slugsLus).toHaveLength(0)
  })

  it('lien libre', async () => {
    expect(await demander('kooki-clean')).toEqual({ status: 200, body: { disponible: true } })
  })

  it('normalise la casse et les espaces autour avant de chercher', async () => {
    await demander('  Kooki-Clean ')
    expect(slugsLus).toEqual(['kooki-clean'])
  })

  it('lien déjà à soi : disponible', async () => {
    plan.proprietaire = { data: { id: 'w-1', user_id: 'u-1' }, error: null }
    expect((await demander('kooki-clean')).body).toEqual({ disponible: true })
  })

  it('lien d’un autre laveur : indisponible', async () => {
    plan.proprietaire = { data: { id: 'w-2', user_id: 'u-2' }, error: null }
    expect((await demander('kooki-clean')).body).toEqual({ disponible: false })
  })

  it('lecture ratée : 503 tracé, jamais « disponible »', async () => {
    plan.proprietaire = { data: null, error: { message: 'base indisponible' } }
    const { status, body } = await demander('kooki-clean')
    expect(status).toBe(503)
    expect(body.disponible).toBeUndefined()
    expect(logger.error).toHaveBeenCalledWith('washer.slug.disponibilite_illisible', { userId: 'u-1' }, { message: 'base indisponible' })
  })
})

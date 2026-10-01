import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// « Renvoyer l'email » : identifié par l'adresse seule. Ce qui compte : ne
// jamais appeler `generateLink` sur une adresse sans compte (Supabase en
// créerait un), ni sur un compte confirmé, et tenir les plafonds.

type Reponse = { data?: unknown; error?: unknown }

let plan: { compte: unknown; fiches: Reponse }

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => {
      const b: Record<string, unknown> = {}
      Object.assign(b, { select: () => b, eq: () => b, limit: async () => plan.fiches })
      return b
    },
  }),
}))
const { envoyerLien, trouverCompte } = vi.hoisted(() => ({ envoyerLien: vi.fn(), trouverCompte: vi.fn() }))
vi.mock('@/lib/confirmationEmail', () => ({ envoyerLienConfirmation: envoyerLien }))
vi.mock('@/lib/compteParEmail', () => ({ trouverCompteParEmail: trouverCompte }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

const { POST } = await import('./route')

const ID = '0b7d3c2e-4f1a-4c8e-9d2b-7a6f5e4d3c2b'
const ORIGINE = 'https://www.washboard.fr'
let numero = 0

// Adresse et IP neuves par défaut : les plafonds en mémoire survivent d'un
// test à l'autre.
function requete({ email = `test${++numero}@exemple.fr`, origin = ORIGINE, type = 'application/json', ip }: {
  email?: unknown; origin?: string | null; type?: string; ip?: string
} = {}) {
  const headers: Record<string, string> = {
    'content-type': type,
    'x-forwarded-for': ip ?? `10.1.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250) + 1}`,
  }
  if (origin) headers.origin = origin
  return new NextRequest(`${ORIGINE}/api/auth/resend-confirmation`, { method: 'POST', headers, body: JSON.stringify({ email }) })
}

const compte = (extra: Record<string, unknown> = {}) => ({ id: ID, email: 'test@exemple.fr', email_confirmed_at: null, ...extra })

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_APP_URL', ORIGINE)
  plan = { compte: compte(), fiches: { data: [{ name: 'Kooki Clean' }], error: null } }
  trouverCompte.mockReset().mockImplementation(async () => plan.compte)
  envoyerLien.mockReset().mockResolvedValue(true)
})
afterEach(() => { vi.unstubAllEnvs() })

describe('POST /api/auth/resend-confirmation', () => {
  it('renvoie le lien au compte en attente de cette adresse', async () => {
    const res = await POST(requete({ email: '  test@exemple.fr ' }))
    expect(res.status).toBe(200)
    expect(trouverCompte).toHaveBeenCalledWith(expect.anything(), 'test@exemple.fr')
    expect(envoyerLien).toHaveBeenCalledWith(expect.anything(), {
      userId: ID, email: 'test@exemple.fr', washerName: 'Kooki Clean', origin: ORIGINE,
    })
  })

  it('refuse une requête venue d’un autre site ou sans JSON', async () => {
    expect((await POST(requete({ origin: 'https://attaquant.tld' }))).status).toBe(403)
    expect((await POST(requete({ origin: null }))).status).toBe(403)
    expect((await POST(requete({ type: 'text/plain' }))).status).toBe(403)
    expect(envoyerLien).not.toHaveBeenCalled()
  })

  it('refuse une adresse absente ou invalide', async () => {
    expect((await POST(requete({ email: 'pas-un-email' }))).status).toBe(400)
    expect((await POST(requete({ email: 42 }))).status).toBe(400)
    expect(trouverCompte).not.toHaveBeenCalled()
  })

  it('adresse sans compte : 404, et SURTOUT aucun appel à generateLink', async () => {
    plan.compte = null
    expect((await POST(requete())).status).toBe(404)
    expect(envoyerLien).not.toHaveBeenCalled()
  })

  it('compte déjà confirmé : 409, rien n’est envoyé', async () => {
    plan.compte = compte({ email_confirmed_at: '2026-09-29T10:00:00Z' })
    const res = await POST(requete())
    expect(res.status).toBe(409)
    expect((await res.json()).confirme).toBe(true)
    expect(envoyerLien).not.toHaveBeenCalled()
  })

  it('recherche du compte en échec : 503, jamais « on envoie quand même »', async () => {
    trouverCompte.mockRejectedValue({ message: 'auth indisponible' })
    expect((await POST(requete())).status).toBe(503)
    expect(envoyerLien).not.toHaveBeenCalled()
  })

  it('nom illisible : l’email part quand même, sans nom', async () => {
    plan.fiches = { data: null, error: { message: 'base indisponible' } }
    expect((await POST(requete())).status).toBe(200)
    expect(envoyerLien).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ washerName: null }))
  })

  it('signale un envoi raté au lieu de prétendre l’avoir fait', async () => {
    envoyerLien.mockResolvedValue(false)
    expect((await POST(requete())).status).toBe(502)
  })

  it('3 renvois par heure et par adresse, puis une attente affichée comme telle', async () => {
    const email = 'plafond-adresse@exemple.fr'
    for (let i = 0; i < 3; i++) expect((await POST(requete({ email }))).status).toBe(200)
    const res = await POST(requete({ email: email.toUpperCase() }))
    expect(res.status).toBe(429)
    const corps = await res.json()
    expect(corps.error).toMatch(/^Un email vient de partir/)
    expect(corps.retryAfter).toBeGreaterThan(0)
    expect(envoyerLien).toHaveBeenCalledTimes(3)
  })

  it('5 demandes par heure et par IP, toutes adresses confondues', async () => {
    const ip = '10.9.9.9'
    for (let i = 0; i < 5; i++) expect((await POST(requete({ ip }))).status).toBe(200)
    expect((await POST(requete({ ip }))).status).toBe(429)
    expect(envoyerLien).toHaveBeenCalledTimes(5)
  })
})

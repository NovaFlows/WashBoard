import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// « Recommencer l'inscription » supprime un compte : seulement sur preuve du
// mot de passe, jamais un compte confirmé, et jamais de fiche orpheline qui
// garderait le numéro de téléphone.

type Reponse = { data?: unknown; error?: unknown }

let plan: {
  connexion: Reponse
  sortie: Reponse
  compte: unknown
  suppressionFiche: Reponse
  suppressionCompte: Reponse
}
const etapes: string[] = []
const sorties: unknown[] = []

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: async () => plan.connexion,
      signOut: async (opts: unknown) => { sorties.push(opts); return plan.sortie },
    },
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    auth: { admin: { deleteUser: async (id: string) => { etapes.push(`compte:${id}`); return plan.suppressionCompte } } },
    from: () => ({
      delete: () => ({ eq: async (_col: string, id: string) => { etapes.push(`fiche:${id}`); return plan.suppressionFiche } }),
    }),
  }),
}))
const { trouverCompte } = vi.hoisted(() => ({ trouverCompte: vi.fn() }))
vi.mock('@/lib/compteParEmail', () => ({ trouverCompteParEmail: trouverCompte }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

const { POST } = await import('./route')

const ID = '0b7d3c2e-4f1a-4c8e-9d2b-7a6f5e4d3c2b'
const ORIGINE = 'https://www.washboard.fr'
let numero = 0

function requete({ email = `faute${++numero}@exemple.fr`, password = 'motdepasse', origin = ORIGINE, ip }: {
  email?: unknown; password?: unknown; origin?: string; ip?: string
} = {}) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    origin,
    'x-forwarded-for': ip ?? `10.2.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250) + 1}`,
  }
  return new NextRequest(`${ORIGINE}/api/auth/restart-signup`, { method: 'POST', headers, body: JSON.stringify({ email, password }) })
}

const nonConfirme = { data: { user: null, session: null }, error: { code: 'email_not_confirmed', message: 'Email not confirmed' } }
const mauvaisMotDePasse = { data: { user: null, session: null }, error: { code: 'invalid_credentials' } }
const connecte = { data: { user: { id: ID }, session: { access_token: 'x' } }, error: null }

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_APP_URL', ORIGINE)
  etapes.length = 0
  sorties.length = 0
  plan = {
    connexion: nonConfirme,
    sortie: { error: null },
    compte: { id: ID, email: 'faute@exemple.fr', email_confirmed_at: null },
    suppressionFiche: { error: null },
    suppressionCompte: { error: null },
  }
  trouverCompte.mockReset().mockImplementation(async () => plan.compte)
})
afterEach(() => { vi.unstubAllEnvs() })

describe('POST /api/auth/restart-signup', () => {
  it('mot de passe prouvé, compte en attente : supprime la fiche puis le compte', async () => {
    const res = await POST(requete({ email: ' Faute@Exemple.fr ' }))
    expect(res.status).toBe(200)
    expect(trouverCompte).toHaveBeenCalledWith(expect.anything(), 'Faute@Exemple.fr')
    expect(etapes).toEqual([`fiche:${ID}`, `compte:${ID}`])
  })

  it('compte confirmé (connexion réussie) : 403, session refermée localement, rien supprimé', async () => {
    plan.connexion = connecte
    const res = await POST(requete())
    expect(res.status).toBe(403)
    expect(sorties).toEqual([{ scope: 'local' }])
    expect(trouverCompte).not.toHaveBeenCalled()
    expect(etapes).toEqual([])
  })

  it('fermeture de la session ratée : refus maintenu', async () => {
    plan.connexion = connecte
    plan.sortie = { error: { message: 'boom' } }
    expect((await POST(requete())).status).toBe(403)
    expect(etapes).toEqual([])
  })

  it('mauvais mot de passe, compte inexistant ou autre refus : même message que /login', async () => {
    plan.connexion = mauvaisMotDePasse
    const res = await POST(requete())
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Email ou mot de passe incorrect')

    plan.connexion = { data: { user: null, session: null }, error: { code: 'over_request_rate_limit' } }
    expect((await (await POST(requete())).json()).error).toBe('Email ou mot de passe incorrect')
    expect(trouverCompte).not.toHaveBeenCalled()
    expect(etapes).toEqual([])
  })

  it('refuse une requête venue d’un autre site, ou incomplète', async () => {
    expect((await POST(requete({ origin: 'https://attaquant.tld' }))).status).toBe(403)
    expect((await POST(requete({ password: '' }))).status).toBe(400)
    expect((await POST(requete({ email: 'sans-arobase' }))).status).toBe(400)
    expect(etapes).toEqual([])
  })

  it('confirmé entre la connexion et la lecture : jamais supprimé', async () => {
    plan.compte = { id: ID, email: 'faute@exemple.fr', email_confirmed_at: '2026-09-29T10:00:00Z' }
    expect((await POST(requete())).status).toBe(403)
    expect(etapes).toEqual([])
  })

  it('recherche du compte en échec ou vide : 503, rien supprimé', async () => {
    trouverCompte.mockRejectedValueOnce({ message: 'auth indisponible' })
    expect((await POST(requete())).status).toBe(503)
    plan.compte = null
    expect((await POST(requete())).status).toBe(503)
    expect(etapes).toEqual([])
  })

  it('fiche non supprimée : le compte reste intact, on peut réessayer', async () => {
    plan.suppressionFiche = { error: { message: 'boom' } }
    expect((await POST(requete())).status).toBe(500)
    expect(etapes).toEqual([`fiche:${ID}`])
  })

  it('compte non supprimé : erreur signalée', async () => {
    plan.suppressionCompte = { error: { message: 'boom' } }
    expect((await POST(requete())).status).toBe(500)
  })

  it('5 essais par heure et par adresse, même en changeant d’IP', async () => {
    plan.connexion = mauvaisMotDePasse
    const email = 'cible@exemple.fr'
    for (let i = 0; i < 5; i++) expect((await POST(requete({ email }))).status).toBe(400)
    expect((await POST(requete({ email }))).status).toBe(429)
  })

  it('5 essais par heure et par IP', async () => {
    plan.connexion = mauvaisMotDePasse
    const ip = '10.8.8.8'
    for (let i = 0; i < 5; i++) expect((await POST(requete({ ip }))).status).toBe(400)
    expect((await POST(requete({ ip }))).status).toBe(429)
  })
})

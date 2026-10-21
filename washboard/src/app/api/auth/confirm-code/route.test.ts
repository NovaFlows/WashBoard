import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// Vérification du code reçu par SMS (2026-10-21), saisi sur /verifier-email. Ce qui compte :
// le compte n'est confirmé et la session ouverte que sur un bon code, les plafonds tiennent,
// et la suite de la confirmation (reprise d'aperçu, notification équipe) est déclenchée.
// Le code lui-même (empreinte, expiration, essais) est testé dans lib/codeSms.test.ts.

type Reponse = { data?: unknown; error?: unknown }

let plan: {
  compte: { id: string; email: string; email_confirmed_at: string | null } | null
  verification: string
  confirmation: Reponse
  lien: Reponse
  session: Reponse
  onboarding: Reponse
}
const sessions: unknown[] = []
const confirmations: unknown[] = []
const fiches: unknown[] = []

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { verifyOtp: async (params: unknown) => { sessions.push(params); return plan.session } },
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        updateUserById: async (id: string, attributs: unknown) => { confirmations.push({ id, attributs }); return plan.confirmation },
        generateLink: async () => plan.lien,
      },
    },
    from: () => {
      const b: Record<string, unknown> = {}
      Object.assign(b, {
        select: () => b, eq: () => b, maybeSingle: async () => plan.onboarding,
        update: (valeurs: unknown) => { fiches.push(valeurs); return { eq: async () => ({ error: null }) } },
      })
      return b
    },
  }),
}))
const { suiteConfirmation, verifierCodeSms } = vi.hoisted(() => ({ suiteConfirmation: vi.fn(), verifierCodeSms: vi.fn() }))
vi.mock('@/lib/confirmationSuite', () => ({ suiteConfirmation }))
vi.mock('@/lib/codeSms', () => ({ verifierCodeSms }))
vi.mock('@/lib/compteParEmail', () => ({ trouverCompteParEmail: async () => plan.compte }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

const { POST } = await import('./route')

const ORIGINE = 'https://www.washboard.fr'
let numero = 0

function requete({ email = `test${++numero}@exemple.fr`, code = '123456', origin = ORIGINE, type = 'application/json', ip }: {
  email?: unknown; code?: unknown; origin?: string | null; type?: string; ip?: string
} = {}) {
  const headers: Record<string, string> = {
    'content-type': type,
    'x-forwarded-for': ip ?? `10.2.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250) + 1}`,
  }
  if (origin) headers.origin = origin
  return new NextRequest(`${ORIGINE}/api/auth/confirm-code`, { method: 'POST', headers, body: JSON.stringify({ email, code }) })
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_APP_URL', ORIGINE)
  sessions.length = 0
  confirmations.length = 0
  fiches.length = 0
  plan = {
    compte: { id: 'u-1', email: 'test@exemple.fr', email_confirmed_at: null },
    verification: 'ok',
    confirmation: { error: null },
    lien: { data: { properties: { hashed_token: 'jeton-123' } }, error: null },
    session: { error: null },
    onboarding: { data: { slug: 'kooki-clean-1f09', onboarding_complete_at: null }, error: null },
  }
  suiteConfirmation.mockReset().mockResolvedValue(undefined)
  verifierCodeSms.mockReset().mockImplementation(async () => plan.verification)
})
afterEach(() => { vi.unstubAllEnvs() })

describe('POST /api/auth/confirm-code', () => {
  it('bon code : confirme le compte, date le numéro, ouvre la session, renvoie l’onboarding', async () => {
    const res = await POST(requete({ email: 'test@exemple.fr', code: '123456' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, destination: '/onboarding' })
    expect(verifierCodeSms).toHaveBeenCalledWith(expect.anything(), 'u-1', '123456')
    expect(confirmations).toEqual([{ id: 'u-1', attributs: { email_confirm: true } }])
    expect(fiches).toEqual([{ telephone_verifie_le: expect.any(String) }])
    expect(sessions).toEqual([{ type: 'magiclink', token_hash: 'jeton-123' }])
    expect(suiteConfirmation).toHaveBeenCalledWith('u-1', 'test@exemple.fr')
  })

  it('compte dont l’onboarding est déjà fait : tableau de bord', async () => {
    plan.onboarding = { data: { slug: 'kooki', onboarding_complete_at: '2026-09-01T10:00:00Z' }, error: null }
    const res = await POST(requete())
    expect((await res.json()).destination).toBe('/dashboard')
  })

  it('refuse une requête venue d’un autre site ou sans JSON', async () => {
    expect((await POST(requete({ origin: 'https://attaquant.tld' }))).status).toBe(403)
    expect((await POST(requete({ origin: null }))).status).toBe(403)
    expect((await POST(requete({ type: 'text/plain' }))).status).toBe(403)
    expect(verifierCodeSms).not.toHaveBeenCalled()
  })

  it('refuse une adresse ou un code mal formés, sans rien vérifier', async () => {
    expect((await POST(requete({ email: 'pas-un-email' }))).status).toBe(400)
    expect((await POST(requete({ code: '123' }))).status).toBe(400)
    expect((await POST(requete({ code: 'abcdef' }))).status).toBe(400)
    expect((await POST(requete({ code: '12345678' }))).status).toBe(400)
    expect(verifierCodeSms).not.toHaveBeenCalled()
  })

  it('mauvais code, expiré ou absent : 400, rien de confirmé, aucune suite', async () => {
    for (const verification of ['invalide', 'expire', 'absent']) {
      plan.verification = verification
      expect((await POST(requete())).status).toBe(400)
    }
    expect(confirmations).toHaveLength(0)
    expect(sessions).toHaveLength(0)
    expect(suiteConfirmation).not.toHaveBeenCalled()
  })

  it('trop d’essais : 400 qui demande un nouveau code', async () => {
    plan.verification = 'bloque'
    const res = await POST(requete())
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/nouveau/)
  })

  it('aucun compte pour cette adresse : même réponse qu’un mauvais code', async () => {
    plan.compte = null
    expect((await POST(requete())).status).toBe(400)
    expect(verifierCodeSms).not.toHaveBeenCalled()
  })

  it('compte déjà confirmé : 409, rien ne change', async () => {
    plan.compte = { id: 'u-1', email: 'test@exemple.fr', email_confirmed_at: '2026-10-01T10:00:00Z' }
    expect((await POST(requete())).status).toBe(409)
    expect(verifierCodeSms).not.toHaveBeenCalled()
  })

  it('session impossible à ouvrir : le compte reste confirmé, direction la connexion', async () => {
    plan.session = { error: { message: 'jeton refusé' } }
    const res = await POST(requete())
    expect(res.status).toBe(200)
    expect((await res.json()).destination).toBe('/login')
    expect(confirmations).toHaveLength(1)
  })

  it('10 tentatives par heure et par adresse, puis un blocage', async () => {
    const email = 'plafond-adresse@exemple.fr'
    for (let i = 0; i < 10; i++) expect((await POST(requete({ email }))).status).toBe(200)
    expect((await POST(requete({ email }))).status).toBe(429)
    expect(verifierCodeSms).toHaveBeenCalledTimes(10)
  })

  it('20 tentatives par heure et par IP, toutes adresses confondues', async () => {
    const ip = '10.9.9.8'
    for (let i = 0; i < 20; i++) expect((await POST(requete({ ip }))).status).toBe(200)
    expect((await POST(requete({ ip }))).status).toBe(429)
    expect(verifierCodeSms).toHaveBeenCalledTimes(20)
  })
})

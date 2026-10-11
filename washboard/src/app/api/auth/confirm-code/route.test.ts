import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// Vérification du code saisi sur /verifier-email. Ce qui compte : la session
// s'ouvre uniquement sur un code valide, les plafonds tiennent, et la suite
// de la confirmation (reprise d'aperçu, notification équipe — testée dans
// `lib/confirmationSuite.ts` via `app/auth/confirm/route.test.ts`) est bien
// déclenchée.

type Reponse = { data?: unknown; error?: unknown }

let plan: { verification: Reponse; onboarding: Reponse }
const verifications: unknown[] = []

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      verifyOtp: async (params: unknown) => { verifications.push(params); return plan.verification },
    },
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => {
      const b: Record<string, unknown> = {}
      Object.assign(b, { select: () => b, eq: () => b, maybeSingle: async () => plan.onboarding })
      return b
    },
  }),
}))
const { suiteConfirmation } = vi.hoisted(() => ({ suiteConfirmation: vi.fn() }))
vi.mock('@/lib/confirmationSuite', () => ({ suiteConfirmation }))
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
  verifications.length = 0
  plan = {
    verification: { data: { user: { id: 'u-1', email: 'test@exemple.fr' } }, error: null },
    onboarding: { data: { slug: 'kooki-clean-1f09', onboarding_complete_at: null }, error: null },
  }
  suiteConfirmation.mockReset().mockResolvedValue(undefined)
})
afterEach(() => { vi.unstubAllEnvs() })

describe('POST /api/auth/confirm-code', () => {
  it('valide le code côté serveur puis renvoie la destination onboarding d’un nouveau compte', async () => {
    const res = await POST(requete({ email: 'test@exemple.fr', code: '123456' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, destination: '/onboarding' })
    expect(verifications).toEqual([{ email: 'test@exemple.fr', token: '123456', type: 'signup' }])
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
    expect(verifications).toHaveLength(0)
  })

  it('refuse une adresse ou un code mal formés, sans appeler Supabase', async () => {
    expect((await POST(requete({ email: 'pas-un-email' }))).status).toBe(400)
    expect((await POST(requete({ code: '123' }))).status).toBe(400)
    expect((await POST(requete({ code: 'abcdef' }))).status).toBe(400)
    expect(verifications).toHaveLength(0)
  })

  it('code refusé (déjà utilisé, expiré, faux) : 400, et aucune suite', async () => {
    plan.verification = { data: { user: null }, error: { code: 'otp_expired' } }
    const res = await POST(requete())
    expect(res.status).toBe(400)
    expect(suiteConfirmation).not.toHaveBeenCalled()
  })

  it('10 tentatives par heure et par adresse, puis un blocage', async () => {
    const email = 'plafond-adresse@exemple.fr'
    for (let i = 0; i < 10; i++) expect((await POST(requete({ email }))).status).toBe(200)
    expect((await POST(requete({ email }))).status).toBe(429)
    expect(verifications).toHaveLength(10)
  })

  it('20 tentatives par heure et par IP, toutes adresses confondues', async () => {
    const ip = '10.9.9.8'
    for (let i = 0; i < 20; i++) expect((await POST(requete({ ip }))).status).toBe(200)
    expect((await POST(requete({ ip }))).status).toBe(429)
    expect(verifications).toHaveLength(20)
  })
})

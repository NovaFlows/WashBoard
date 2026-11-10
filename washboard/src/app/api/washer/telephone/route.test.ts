import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Changement de numéro d'un laveur connecté (2026-11-10). Ce qui compte : le mot de passe est
// exigé, le code part sur le NOUVEAU numéro, le numéro changé est celui de la demande (jamais
// celui du navigateur), un numéro déjà pris est refusé, et la vérification du numéro est datée.
// Le code lui-même (empreinte, expiration, essais) est testé dans lib/codeSms.test.ts.

type Reponse = { data?: unknown; error?: unknown }

let plan: {
  utilisateur: { id: string; email: string } | null
  fiche: Reponse
  pris: Reponse
  demande: Reponse
  motDePasse: boolean
  envoi: unknown
  verification: string
  ecriture: Reponse
}
const ecritures: Record<string, unknown>[] = []
const envois: unknown[] = []

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: plan.utilisateur } }) } }),
}))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: async () => (plan.motDePasse ? { data: { session: {} }, error: null } : { data: {}, error: { code: 'invalid_credentials' } }),
      signOut: async () => ({}),
    },
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const b: Record<string, unknown> = {}
      let colonnes = ''
      let ecriture: Record<string, unknown> | null = null
      Object.assign(b, {
        select: (c: string) => { colonnes = c; return b },
        eq: () => b, neq: () => b, not: () => b, lt: () => b,
        limit: () => Promise.resolve(table === 'washers' && colonnes === 'id' ? plan.pris : plan.fiche),
        maybeSingle: () => Promise.resolve(plan.demande),
        delete: () => b,
        update: (v: Record<string, unknown>) => { ecriture = v; return b },
        then: (ok: (v: Reponse) => unknown, ko?: (e: unknown) => unknown) => {
          if (ecriture) ecritures.push(ecriture)
          return Promise.resolve(ecriture ? plan.ecriture : { error: null }).then(ok, ko)
        },
      })
      return b
    },
  }),
}))
const { envoyerCodeSms, verifierCodeSms } = vi.hoisted(() => ({ envoyerCodeSms: vi.fn(), verifierCodeSms: vi.fn() }))
vi.mock('@/lib/codeSms', async () => {
  const reel = await vi.importActual<typeof import('@/lib/codeSms')>('@/lib/codeSms')
  return { ...reel, envoyerCodeSms, verifierCodeSms }
})
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

const { POST } = await import('./route')

const ORIGINE = 'https://www.washboard.fr'
let n = 0

function requete(corps: Record<string, unknown>, { origin = ORIGINE, type = 'application/json' }: { origin?: string | null; type?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': type, 'x-forwarded-for': `10.4.${++n % 250}.${Math.floor(n / 250) + 1}` }
  if (origin) headers.origin = origin
  return new NextRequest(`${ORIGINE}/api/washer/telephone`, { method: 'POST', headers, body: JSON.stringify(corps) })
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_APP_URL', ORIGINE)
  vi.stubEnv('PHONE_UNIQUENESS_EXEMPT', '')
  ecritures.length = 0
  envois.length = 0
  n += 1000
  plan = {
    utilisateur: { id: `u-${n}`, email: 'laveur@exemple.fr' },
    fiche: { data: [{ id: 'w1', phone: '0600000001' }], error: null },
    pris: { data: [], error: null },
    demande: { data: { telephone: '0612345678' }, error: null },
    motDePasse: true,
    envoi: { ok: true },
    verification: 'ok',
    ecriture: { error: null },
  }
  envoyerCodeSms.mockReset().mockImplementation(async (_a: unknown, params: unknown) => { envois.push(params); return plan.envoi })
  verifierCodeSms.mockReset().mockImplementation(async () => plan.verification)
})

describe('POST /api/washer/telephone — envoi du code', () => {
  const demande = (extra: Record<string, unknown> = {}) => ({ etape: 'code', telephone: '06 12 34 56 78', motDePasse: 'secret-123', ...extra })

  it('envoie le code sur le nouveau numéro, normalisé', async () => {
    const res = await POST(requete(demande()))
    expect(res.status).toBe(200)
    expect(envois).toEqual([{ userId: plan.utilisateur!.id, telephone: '0612345678' }])
    expect((await res.json()).telephone).toBe('06 •• •• •• 78')
  })

  it('refuse sans session, hors site, ou sans JSON', async () => {
    plan.utilisateur = null
    expect((await POST(requete(demande()))).status).toBe(401)
    plan.utilisateur = { id: 'u-x', email: 'a@b.fr' }
    expect((await POST(requete(demande(), { origin: 'https://evil.example' }))).status).toBe(403)
    expect((await POST(requete(demande(), { type: 'text/plain' }))).status).toBe(403)
    expect(envois).toHaveLength(0)
  })

  it('exige le bon mot de passe, et n’envoie aucun SMS sinon', async () => {
    plan.motDePasse = false
    const res = await POST(requete(demande()))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('Mot de passe')
    expect((await POST(requete(demande({ motDePasse: '' })))).status).toBe(400)
    expect(envois).toHaveLength(0)
  })

  it('refuse un numéro invalide, un fixe, ou le numéro actuel', async () => {
    for (const telephone of ['12', '01 23 45 67 89', '06 00 00 00 01']) {
      expect((await POST(requete(demande({ telephone })))).status).toBe(400)
    }
    expect(envois).toHaveLength(0)
  })

  it('refuse un numéro déjà associé à un autre compte, sans SMS', async () => {
    plan.pris = { data: [{ id: 'w2' }], error: null }
    const res = await POST(requete(demande()))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('déjà associé')
    expect(envois).toHaveLength(0)
  })

  it('une lecture d’unicité en échec ne laisse pas passer le doublon', async () => {
    plan.pris = { data: null, error: { message: 'panne' } }
    expect((await POST(requete(demande()))).status).toBe(503)
    expect(envois).toHaveLength(0)
  })

  it('un numéro exempté d’unicité passe même s’il est déjà pris', async () => {
    vi.stubEnv('PHONE_UNIQUENESS_EXEMPT', '06 12 34 56 78')
    plan.pris = { data: [{ id: 'w2' }], error: null }
    expect((await POST(requete(demande()))).status).toBe(200)
  })

  it('répète la raison d’un envoi refusé (attente, panne)', async () => {
    plan.envoi = { ok: false, raison: 'attente', secondes: 42 }
    const attente = await POST(requete(demande()))
    expect(attente.status).toBe(429)
    expect((await attente.json()).retryAfter).toBe(42)
    plan.envoi = { ok: false, raison: 'panne' }
    expect((await POST(requete(demande()))).status).toBe(502)
  })
})

describe('POST /api/washer/telephone — confirmation', () => {
  const confirmation = (code: unknown = '123456') => ({ etape: 'confirmer', code })

  it('change le numéro pour celui de la demande, et date la vérification', async () => {
    const res = await POST(requete({ ...confirmation(), telephone: '0699999999' }))
    expect(res.status).toBe(200)
    expect(ecritures).toHaveLength(1)
    expect(ecritures[0]).toMatchObject({ phone: '0612345678' })
    expect(typeof ecritures[0].telephone_verifie_le).toBe('string')
  })

  it('un mauvais code ne change rien', async () => {
    plan.verification = 'invalide'
    const res = await POST(requete(confirmation()))
    expect(res.status).toBe(400)
    expect(ecritures).toHaveLength(0)
  })

  it('un code expiré, ou des essais épuisés, ne changent rien', async () => {
    for (const v of ['expire', 'bloque', 'absent']) {
      plan.verification = v
      expect((await POST(requete(confirmation()))).status).toBe(400)
    }
    expect(ecritures).toHaveLength(0)
  })

  it('sans demande en cours, on recommence', async () => {
    plan.demande = { data: null, error: null }
    const res = await POST(requete(confirmation()))
    expect(res.status).toBe(400)
    expect(verifierCodeSms).not.toHaveBeenCalled()
  })

  it('un numéro pris entre-temps est refusé avant de consommer le code', async () => {
    plan.pris = { data: [{ id: 'w2' }], error: null }
    expect((await POST(requete(confirmation()))).status).toBe(400)
    expect(verifierCodeSms).not.toHaveBeenCalled()
    expect(ecritures).toHaveLength(0)
  })

  it('refuse un code qui n’a pas six chiffres', async () => {
    expect((await POST(requete(confirmation('12ab')))).status).toBe(400)
    expect(verifierCodeSms).not.toHaveBeenCalled()
  })

  it('une écriture en échec le dit', async () => {
    plan.ecriture = { error: { message: 'panne' } }
    expect((await POST(requete(confirmation()))).status).toBe(500)
  })
})

describe('POST /api/washer/telephone — étape inconnue', () => {
  it('refuse', async () => {
    expect((await POST(requete({ etape: 'autre' }))).status).toBe(400)
  })
})

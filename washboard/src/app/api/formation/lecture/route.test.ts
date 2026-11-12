import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { verifierJetonLecture } from '@/lib/formationProtection'

// Lecture d'une leçon (2026-11-10) : seul un compte autorisé reçoit un jeton, et ce jeton est lié
// à son compte et à la leçon demandée. Le reste (signature, expiration) est testé dans
// lib/formationProtection.test.ts.

let utilisateur: { id: string; email: string } | null

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: utilisateur } }) } }),
}))

// Le catalogue vient de la base en production ; ici, celui d'exemple, sans réseau (61 appels réels
// dans le test de limite dépassaient le délai du test, et faisaient échouer le build).
vi.mock('@/lib/formationCatalogue', async () => {
  const { CATALOGUE_DEMO } = await import('@/lib/formation')
  return {
    chargerCatalogue: async () => ({ packs: CATALOGUE_DEMO, demo: true }),
    cheminVideoDeLecon: async () => null,
  }
})

const { POST } = await import('./route')

const ORIGINE = 'https://www.washboard.fr'
const SECRET = 'un-secret-de-test-de-plus-de-24-caracteres'
let n = 0

function requete(corps: unknown, { origin = ORIGINE, type = 'application/json' }: { origin?: string | null; type?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': type, 'x-forwarded-for': `10.9.${++n % 250}.1` }
  if (origin) headers.origin = origin
  return new NextRequest(`${ORIGINE}/api/formation/lecture`, { method: 'POST', headers, body: JSON.stringify(corps) })
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_APP_URL', ORIGINE)
  vi.stubEnv('FORMATION_SECRET', SECRET)
  vi.stubEnv('FORMATION_USER_IDS', '')
  vi.stubEnv('FORMATION_OUVERTE', '')
  n += 100
  utilisateur = { id: `u-${n}`, email: 'laveur@exemple.fr' }
  vi.stubEnv('FORMATION_USER_IDS', utilisateur.id)
})

describe('POST /api/formation/lecture', () => {
  it('donne un jeton lié au compte et à la leçon, avec le filigrane', async () => {
    const res = await POST(requete({ leconId: 'l-2-2' }))
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const corps = await res.json()
    expect(verifierJetonLecture(corps.jeton, { secret: SECRET })).toMatchObject({ ok: true, userId: utilisateur!.id, leconId: 'l-2-2' })
    expect(corps.filigrane).toContain('laveur@exemple.fr')
    expect(corps.source).toBeNull()
  })

  it('refuse sans session, hors site, ou sans JSON', async () => {
    expect((await POST(requete({ leconId: 'l-2-2' }, { origin: 'https://evil.example' }))).status).toBe(403)
    expect((await POST(requete({ leconId: 'l-2-2' }, { type: 'text/plain' }))).status).toBe(403)
    utilisateur = null
    expect((await POST(requete({ leconId: 'l-2-2' }))).status).toBe(401)
  })

  it('n’existe pas pour un compte qui n’a pas accès à l’onglet', async () => {
    vi.stubEnv('FORMATION_USER_IDS', 'quelquun-d-autre')
    expect((await POST(requete({ leconId: 'l-2-2' }))).status).toBe(404)
  })

  it('refuse une leçon inconnue ou une requête sans leçon', async () => {
    expect((await POST(requete({ leconId: 'nope' }))).status).toBe(404)
    expect((await POST(requete({}))).status).toBe(400)
    expect((await POST(requete({ leconId: 42 }))).status).toBe(400)
  })

  it('sans secret configuré, répond « indisponible » plutôt que de signer avec rien', async () => {
    vi.stubEnv('FORMATION_SECRET', '')
    expect((await POST(requete({ leconId: 'l-2-2' }))).status).toBe(503)
    vi.stubEnv('FORMATION_SECRET', 'court')
    expect((await POST(requete({ leconId: 'l-2-2' }))).status).toBe(503)
  })

  it('limite le nombre de jetons demandés par compte', async () => {
    let dernier = 200
    for (let i = 0; i < 61; i++) dernier = (await POST(requete({ leconId: 'l-2-2' }))).status
    expect(dernier).toBe(429)
  })
})

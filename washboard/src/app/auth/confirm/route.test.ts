import { describe, it, expect, vi, beforeEach } from 'vitest'

// Arrivée du lien de confirmation. Ce qui compte : la reprise de l'aperçu et
// la notification de l'équipe (déplacées ici depuis l'inscription) partent
// une fois la confirmation réussie, jamais avant, et ne la bloquent jamais.

type Reponse = { data?: unknown; error?: unknown }

let plan: { verification: Reponse; fiches: Reponse; onboarding: Reponse }
const verifications: unknown[] = []

class Redirection extends Error {
  constructor(public url: string) { super(`redirect ${url}`) }
}

vi.mock('next/navigation', () => ({
  redirect: (url: string) => { throw new Redirection(url) },
}))
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
      Object.assign(b, {
        select: () => b,
        eq: () => b,
        limit: async () => plan.fiches,
        maybeSingle: async () => plan.onboarding,
      })
      return b
    },
  }),
}))
vi.mock('@/lib/push', () => ({ notifierEquipe: vi.fn(async () => {}) }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

// La reprise elle-même est testée dans lib/repriseApercu.test.ts ; ici, on
// vérifie seulement comment la confirmation s'en sert.
const { reprendreApercu } = vi.hoisted(() => ({ reprendreApercu: vi.fn() }))
vi.mock('@/lib/repriseApercu', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/repriseApercu')>()),
  reprendreApercu,
}))

const { GET } = await import('./route')
const { notifierEquipe } = await import('@/lib/push')
const { logger } = await import('@/lib/logger')

async function ouvrir(query = '?token_hash=jeton&type=signup'): Promise<string> {
  const { NextRequest } = await import('next/server')
  try {
    await GET(new NextRequest(`https://www.washboard.fr/auth/confirm${query}`))
  } catch (e) {
    if (e instanceof Redirection) return e.url
    throw e
  }
  throw new Error('aucune redirection')
}

const notification = () => vi.mocked(notifierEquipe).mock.calls[0][0]

beforeEach(() => {
  vi.clearAllMocks()
  verifications.length = 0
  plan = {
    verification: { data: { user: { id: 'u-1', email: 'test@exemple.fr' } }, error: null },
    fiches: { data: [{ id: 'w-1', name: 'Kooki Clean', phone: '0611223344', trial_ends_at: '2026-10-29T10:00:00Z' }], error: null },
    onboarding: { data: { slug: 'kooki-clean-1f09', onboarding_complete_at: null }, error: null },
  }
  reprendreApercu.mockResolvedValue({ statut: 'aucun' })
})

describe('GET /auth/confirm — validation du lien', () => {
  it('valide le jeton côté serveur puis ouvre l’onboarding d’un nouveau compte', async () => {
    expect(await ouvrir()).toBe('/onboarding')
    expect(verifications).toEqual([{ token_hash: 'jeton', type: 'signup' }])
  })

  it('compte dont l’onboarding est déjà fait : tableau de bord', async () => {
    plan.onboarding = { data: { slug: 'kooki', onboarding_complete_at: '2026-09-01T10:00:00Z' }, error: null }
    expect(await ouvrir()).toBe('/dashboard')
  })

  it('état de l’onboarding illisible : tableau de bord plutôt qu’un blocage', async () => {
    plan.onboarding = { data: null, error: { message: 'base indisponible' } }
    expect(await ouvrir()).toBe('/dashboard')
  })

  it('renvoie vers /verifier-email sur un lien incomplet, sans rien valider', async () => {
    expect(await ouvrir('?type=signup')).toBe('/verifier-email?lien=invalide')
    expect(await ouvrir('?token_hash=jeton&type=recovery')).toBe('/verifier-email?lien=invalide')
    expect(verifications).toHaveLength(0)
  })

  it('lien refusé (déjà utilisé, expiré) : ni reprise, ni notification', async () => {
    plan.verification = { data: { user: null }, error: { code: 'otp_expired' } }
    expect(await ouvrir()).toBe('/verifier-email?lien=invalide')
    expect(reprendreApercu).not.toHaveBeenCalled()
    expect(notifierEquipe).not.toHaveBeenCalled()
  })
})

describe('GET /auth/confirm — reprise de l’aperçu', () => {
  it('reprend l’aperçu du numéro dans la fiche du compte confirmé, et le dit à l’équipe', async () => {
    reprendreApercu.mockResolvedValue({ statut: 'reprise', apercu: { name: 'URHUS AUTO', slug: 'urhus-auto' } })
    await ouvrir()
    expect(reprendreApercu).toHaveBeenCalledTimes(1)
    expect(reprendreApercu).toHaveBeenCalledWith(expect.anything(), { id: 'w-1', phone: '0611223344' })
    expect(notification().title).toMatch(/aperçu repris/)
    expect(notification().body).toMatch(/URHUS AUTO/)
  })

  it('numéro sans aperçu : notification habituelle, une seule', async () => {
    await ouvrir()
    expect(notifierEquipe).toHaveBeenCalledTimes(1)
    expect(notification().title).toBe('🎉 Nouveau client WashBoard')
    expect(notification().body).toMatch(/Kooki Clean/)
    expect(notification().body).toMatch(/test@exemple\.fr/)
  })

  it('une reprise qui plante ne bloque JAMAIS la confirmation', async () => {
    reprendreApercu.mockRejectedValue(new Error('base indisponible'))
    expect(await ouvrir()).toBe('/onboarding')
    expect(notification().title).toMatch(/échouée/)
  })

  it('fiche illisible : confirmation maintenue, échec tracé', async () => {
    plan.fiches = { data: null, error: { message: 'base indisponible' } }
    expect(await ouvrir()).toBe('/onboarding')
    expect(reprendreApercu).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith('auth.confirm.washer_read_failed', { userId: 'u-1' }, { message: 'base indisponible' })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Ce helper double la RLS Supabase : il fournit aux routes `[id]` le laveur
// connecté, pour qu'elles filtrent AUSSI côté applicatif. Son contrat est donc
// une règle de cloisonnement — en cas de doute sur l'identité, il ne laisse
// rien passer. C'est exactement ce que ces tests vérifient.

const getUser = vi.fn()
const single = vi.fn()

vi.mock('./supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({ select: () => ({ eq: () => ({ single }) }) }),
  }),
}))

import { requireWasher } from './requireWasher'

const connecte = (id = 'u1') => getUser.mockResolvedValue({ data: { user: { id } } })

beforeEach(() => {
  getUser.mockReset()
  single.mockReset()
})

describe('requireWasher', () => {
  it('rend le laveur connecté quand tout est en ordre', async () => {
    connecte('u1')
    single.mockResolvedValue({ data: { id: 'w1' }, error: null })

    const r = await requireWasher()

    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.ctx.washerId).toBe('w1')
      expect(r.ctx.supabase).toBeDefined()
    }
  })

  it('refuse un visiteur non connecté, en 401', async () => {
    getUser.mockResolvedValue({ data: { user: null } })

    const r = await requireWasher()

    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.response.status).toBe(401)
      await expect(r.response.json()).resolves.toEqual({ error: 'Non autorisé' })
    }
  })

  it('refuse quand la fiche laveur est introuvable, en 404', async () => {
    connecte()
    single.mockResolvedValue({ data: null, error: null })

    const r = await requireWasher()

    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.response.status).toBe(404)
      await expect(r.response.json()).resolves.toEqual({ error: 'Profil introuvable' })
    }
  })

  it('refuse aussi quand la lecture échoue : sans certitude, aucune ligne n’est touchée', async () => {
    // Le point sensible. Laisser passer ici reviendrait à exécuter une action
    // sur des données sans savoir à qui elles appartiennent.
    connecte()
    single.mockResolvedValue({ data: null, error: { code: '57014', message: 'timeout' } })

    const r = await requireWasher()

    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(404)
  })
})

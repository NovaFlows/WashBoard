import { describe, it, expect, vi, beforeEach } from 'vitest'

// Fin de la visite guidée. Ce qui compte : jamais sans session, la date posée
// une seule fois, et tout échec renvoie un errorId tracé — le laveur ne voit pas
// la réponse, la trace est le seul moyen de savoir que la visite reviendra.

let utilisateur: unknown
const { marquer } = vi.hoisted(() => ({ marquer: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: utilisateur } }) } }),
}))
vi.mock('@/lib/marquerUneFois', () => ({ marquerUneFois: marquer }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

const { POST } = await import('./route')
const { logger } = await import('@/lib/logger')

async function envoyer() {
  const res = await POST()
  return { status: res.status, body: await res.json() }
}

beforeEach(() => {
  vi.clearAllMocks()
  utilisateur = { id: 'u-1' }
  marquer.mockResolvedValue({ ok: true })
})

describe('POST /api/washer/visite-guidee', () => {
  it('refuse un visiteur non connecté, sans rien écrire', async () => {
    utilisateur = null
    expect((await envoyer()).status).toBe(401)
    expect(marquer).not.toHaveBeenCalled()
  })

  it('pose dashboard_tour_complete_at sur la fiche de l’utilisateur connecté', async () => {
    expect(await envoyer()).toEqual({ status: 200, body: { success: true } })
    expect(marquer).toHaveBeenCalledWith(expect.anything(), 'u-1', 'dashboard_tour_complete_at')
  })

  it('écriture refusée : 500 avec errorId, tracé', async () => {
    marquer.mockResolvedValue({ ok: false, cause: 'ecriture', erreur: { code: '42501', message: 'permission denied' } })
    const { status, body } = await envoyer()
    expect(status).toBe(500)
    expect(body.errorId).toEqual(expect.any(String))
    expect(logger.error).toHaveBeenCalledWith('washer.visite_guidee.db', expect.objectContaining({ userId: 'u-1' }), expect.anything())
  })

  it('écriture écartée en silence : 500 avec errorId, tracé', async () => {
    marquer.mockResolvedValue({ ok: false, cause: 'non_enregistre', erreur: new Error('aucune ligne mise à jour') })
    const { status, body } = await envoyer()
    expect(status).toBe(500)
    expect(body.errorId).toEqual(expect.any(String))
    expect(logger.error).toHaveBeenCalledWith('washer.visite_guidee.non_enregistre', expect.objectContaining({ userId: 'u-1' }), expect.anything())
  })
})

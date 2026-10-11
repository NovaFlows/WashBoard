import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Fin de la visite guidée (POST) et reprise à volonté depuis le Guide (DELETE).
// Ce qui compte : jamais sans session, la date posée une seule fois (POST) ou
// effacée (DELETE), et tout échec renvoie un errorId tracé — le laveur ne voit
// pas la réponse, la trace est le seul moyen de savoir que ça n'a pas marché.

let utilisateur: unknown
let erreurMiseAJour: unknown
const { marquer, miseAJour } = vi.hoisted(() => ({ marquer: vi.fn(), miseAJour: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: utilisateur } }) },
    from: (table: string) => ({
      update: (valeurs: Record<string, unknown>) => {
        miseAJour(table, valeurs)
        return { eq: async () => ({ error: erreurMiseAJour }) }
      },
    }),
  }),
}))
vi.mock('@/lib/marquerUneFois', () => ({ marquerUneFois: marquer }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

const { POST, DELETE } = await import('./route')
const { logger } = await import('@/lib/logger')

const requete = (appareil: string | null = 'mobile') =>
  new NextRequest(`https://www.washboard.fr/api/washer/visite-guidee${appareil ? `?appareil=${appareil}` : ''}`)

async function envoyer(appareil: string | null = 'mobile') {
  const res = await POST(requete(appareil))
  return { status: res.status, body: await res.json() }
}

async function envoyerSuppression(appareil: string | null = 'mobile') {
  const res = await DELETE(requete(appareil))
  return { status: res.status, body: await res.json() }
}

beforeEach(() => {
  vi.clearAllMocks()
  utilisateur = { id: 'u-1' }
  marquer.mockResolvedValue({ ok: true })
  erreurMiseAJour = null
})

describe('POST /api/washer/visite-guidee', () => {
  it('refuse un visiteur non connecté, sans rien écrire', async () => {
    utilisateur = null
    expect((await envoyer()).status).toBe(401)
    expect(marquer).not.toHaveBeenCalled()
  })

  it('pose la date du tuto mobile, sans toucher au tuto ordinateur', async () => {
    expect(await envoyer('mobile')).toEqual({ status: 200, body: { success: true } })
    expect(marquer).toHaveBeenCalledWith(expect.anything(), 'u-1', 'tuto_mobile_vu_le')
  })

  it('pose la date du tuto ordinateur, sans toucher au tuto mobile', async () => {
    expect(await envoyer('ordinateur')).toEqual({ status: 200, body: { success: true } })
    expect(marquer).toHaveBeenCalledWith(expect.anything(), 'u-1', 'tuto_ordinateur_vu_le')
  })

  it('refuse un appareil absent ou inconnu, sans rien écrire', async () => {
    expect((await envoyer(null)).status).toBe(400)
    expect((await envoyer('tablette')).status).toBe(400)
    expect(marquer).not.toHaveBeenCalled()
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

describe('DELETE /api/washer/visite-guidee — « Revoir le tuto »', () => {
  it('refuse un visiteur non connecté, sans rien écrire', async () => {
    utilisateur = null
    expect((await envoyerSuppression()).status).toBe(401)
    expect(miseAJour).not.toHaveBeenCalled()
  })

  it('efface seulement la date du tuto de cet appareil', async () => {
    expect(await envoyerSuppression('ordinateur')).toEqual({ status: 200, body: { success: true } })
    expect(miseAJour).toHaveBeenCalledWith('washers', { tuto_ordinateur_vu_le: null })
  })

  it('écriture refusée : 500 avec errorId, tracé', async () => {
    erreurMiseAJour = { code: '42501', message: 'permission denied' }
    const { status, body } = await envoyerSuppression()
    expect(status).toBe(500)
    expect(body.errorId).toEqual(expect.any(String))
    expect(logger.error).toHaveBeenCalledWith('washer.visite_guidee.redemarrer.db', expect.objectContaining({ userId: 'u-1' }), expect.anything())
  })
})

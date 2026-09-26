import { describe, it, expect, vi, afterEach } from 'vitest'
import { enregistrerReglages } from './enregistrerReglages'

afterEach(() => vi.unstubAllGlobals())

const reponse = (status: number, corps?: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => { if (corps === undefined) throw new Error('vide'); return corps } }) as Response

describe('enregistrerReglages', () => {
  it('envoie un PATCH JSON à /api/washer', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reponse(200, { success: true }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await enregistrerReglages({ review_enabled: true })).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledWith('/api/washer', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: '{"review_enabled":true}',
    })
  })

  it('une panne réseau devient une phrase claire', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const r = await enregistrerReglages({})
    expect(r).toEqual({ ok: false, message: expect.stringContaining('connexion') })
  })

  it('un refus explicite porte le message du serveur', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(403, { error: 'Cette option est réservée au plan Pro.' })))
    expect(await enregistrerReglages({ followup_enabled: true })).toEqual({ ok: false, message: 'Cette option est réservée au plan Pro.' })
  })

  it('une session expirée est nommée', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(401, { error: 'Non autorisé' })))
    expect(await enregistrerReglages({})).toEqual({ ok: false, message: expect.stringContaining('session') })
  })

  it('une panne serveur n’expose pas son texte technique', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(500, { error: 'duplicate key value violates…' })))
    const r = await enregistrerReglages({})
    expect(r).toEqual({ ok: false, message: expect.stringContaining('Réessayez') })
    expect(JSON.stringify(r)).not.toContain('duplicate')
  })

  it('un refus au corps illisible retombe sur le message générique', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(400)))
    expect(await enregistrerReglages({})).toEqual({ ok: false, message: expect.stringContaining('Réessayez') })
  })
})

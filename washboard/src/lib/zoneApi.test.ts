import { describe, it, expect, vi, afterEach } from 'vitest'
import { enregistrerZoneCreneaux, ECHEC_RESEAU, ECHEC_SERVEUR, ECHEC_SESSION } from './zoneApi'

afterEach(() => vi.unstubAllGlobals())

const reponse = (status: number, corps?: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => { if (corps === undefined) throw new Error('vide'); return corps },
  }) as Response

describe('enregistrerZoneCreneaux', () => {
  it('un seul PATCH /api/washer, avec les seuls champs de la feuille', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reponse(200, { success: true }))
    vi.stubGlobal('fetch', fetchMock)

    const r = await enregistrerZoneCreneaux({ zone_config: { enabled: false } })
    expect(r).toEqual({ ok: true, data: null })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/washer')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ zone_config: { enabled: false } })
  })

  it('une panne réseau dit que rien n’est parti, jamais « Failed to fetch »', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    expect(await enregistrerZoneCreneaux({})).toEqual({ ok: false, message: ECHEC_RESEAU })
  })

  it('une panne serveur : la phrase claire + la référence, jamais le texte technique', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(500, { error: 'boom', errorId: 'abcdef0123456789' })))
    expect(await enregistrerZoneCreneaux({})).toEqual({ ok: false, message: `${ECHEC_SERVEUR} (réf. abcdef01)` })
  })

  it('une panne sans référence reste lisible', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(503)))
    expect(await enregistrerZoneCreneaux({})).toEqual({ ok: false, message: ECHEC_SERVEUR })
  })

  it('un refus explicite du serveur est repris tel quel', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(403, { error: 'Réservé au plan Pro' })))
    expect(await enregistrerZoneCreneaux({})).toEqual({ ok: false, message: 'Réservé au plan Pro' })
  })

  it('une session expirée se dit clairement', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(401, { error: 'Unauthorized' })))
    expect(await enregistrerZoneCreneaux({})).toEqual({ ok: false, message: ECHEC_SESSION })
  })
})

import { describe, it, expect, vi, afterEach } from 'vitest'
import { enregistrerApparence, envoyerImage, PHRASE_IMAGE_TROP_LOURDE } from './apparenceApi'

afterEach(() => vi.unstubAllGlobals())

const reponse = (status: number, corps?: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => { if (corps === undefined) throw new Error('vide'); return corps } }) as Response

const image = new File([new Uint8Array([1, 2, 3])], 'logo.webp', { type: 'image/webp' })

describe('enregistrerApparence', () => {
  it('PATCH /api/washer avec seulement les champs modifiés', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reponse(200, { success: true }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await enregistrerApparence({ brand_color: '#0ea5e9' })).toEqual({ ok: true, data: null })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/washer')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ brand_color: '#0ea5e9' })
  })

  it('retirer le logo ou le fond envoie null, pas une chaîne vide', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reponse(200, { success: true }))
    vi.stubGlobal('fetch', fetchMock)
    await enregistrerApparence({ logo_url: null })
    await enregistrerApparence({ background_theme: null })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ logo_url: null })
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ background_theme: null })
  })

  it('une panne serveur : phrase claire + référence, jamais le texte technique', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(500, { error: 'boom', errorId: 'abcdef0123456789' })))
    expect(await enregistrerApparence({ website_url: null })).toEqual({
      ok: false, message: 'Enregistrement impossible. Réessayez dans un instant. (réf. abcdef01)',
    })
  })

  it('une panne réseau : « Vérifiez votre connexion », jamais « Failed to fetch »', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const r = await enregistrerApparence({ welcome_message: 'Bonjour' })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.message).toContain('connexion')
    expect(!r.ok && r.message).not.toContain('fetch')
  })

  it('un refus explicite (4xx) arrive tel quel', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(403, { error: 'Cette option est réservée au plan Pro.' })))
    expect(await enregistrerApparence({ brand_color: '#000' })).toEqual({ ok: false, message: 'Cette option est réservée au plan Pro.' })
  })
})

describe('envoyerImage', () => {
  it('POST multipart sur la route du logo, champ « file », et rend l’adresse publique', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reponse(200, { url: 'https://x.co/logos/u.webp' }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await envoyerImage('logo', image)).toEqual({ ok: true, data: 'https://x.co/logos/u.webp' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/washer/logo')
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(FormData)
    expect((init.body as FormData).get('file')).toBeInstanceOf(File)
    // pas d'en-tête Content-Type posé à la main : le navigateur ajoute la frontière
    expect(init.headers).toBeUndefined()
  })

  it('la route du fond est /api/washer/background', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reponse(200, { url: 'https://x.co/bg.webp' }))
    vi.stubGlobal('fetch', fetchMock)
    await envoyerImage('background', image)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/washer/background')
  })

  it('413 (plafond serveur) : une phrase claire, pas le texte de la route', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(413, { error: 'Image trop lourde. Essayez avec…' })))
    expect(await envoyerImage('logo', image)).toEqual({ ok: false, message: PHRASE_IMAGE_TROP_LOURDE })
  })

  it('413 sans corps JSON (limite de l’hébergeur) : la même phrase', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(413)))
    expect(await envoyerImage('background', image)).toEqual({ ok: false, message: PHRASE_IMAGE_TROP_LOURDE })
  })

  it('une panne serveur : « Envoi impossible » + référence', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(500, { error: 'storage', errorId: '1234567890abcdef' })))
    expect(await envoyerImage('logo', image)).toEqual({ ok: false, message: 'Envoi impossible. Réessayez dans un instant. (réf. 12345678)' })
  })

  it('une panne réseau : « Envoi impossible » + connexion', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const r = await envoyerImage('logo', image)
    expect(!r.ok && r.message).toBe('Envoi impossible. Vérifiez votre connexion et réessayez.')
  })

  it('une session expirée est nommée', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(401, { error: 'Non autorisé' })))
    const r = await envoyerImage('logo', image)
    expect(!r.ok && r.message).toContain('session')
  })

  it('un succès sans adresse est un échec : on n’affiche pas un logo qu’on ne connaît pas', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(200, {})))
    const r = await envoyerImage('logo', image)
    expect(r.ok).toBe(false)
    expect(!r.ok && r.message).toContain('Rechargez')
  })

  it('un succès au corps illisible est aussi un échec', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(200)))
    expect((await envoyerImage('logo', image)).ok).toBe(false)
  })
})

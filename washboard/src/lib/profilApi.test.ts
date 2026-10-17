import { describe, it, expect, vi, afterEach } from 'vitest'
import { enregistrerProfil, actionCompte, envoyerSmsTest } from './profilApi'

afterEach(() => vi.unstubAllGlobals())

const reponse = (status: number, corps?: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => { if (corps === undefined) throw new Error('vide'); return corps } }) as Response

function serveur(corps: unknown = { data: null }, status = 200) {
  const mock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => reponse(status, corps))
  vi.stubGlobal('fetch', mock)
  return mock
}

const appel = (mock: ReturnType<typeof serveur>) => {
  const [url, init] = mock.mock.calls[0]
  return { url, method: init?.method, corps: init?.body === undefined ? undefined : JSON.parse(String(init.body)) }
}

describe('enregistrerProfil', () => {
  it('n’envoie que les champs passés : le reste du profil n’est pas écrasé', async () => {
    const mock = serveur()
    expect(await enregistrerProfil({ phone: '0612345678' })).toEqual({ ok: true, data: null })
    expect(appel(mock)).toEqual({ url: '/api/washer', method: 'PATCH', corps: { phone: '0612345678' } })
  })

  it('un refus remonte comme un échec', async () => {
    serveur({ error: 'SIRET invalide' }, 400)
    expect((await enregistrerProfil({ facture_siret: '123' })).ok).toBe(false)
  })
})

describe('actionCompte', () => {
  it('la suppression transmet le nom exact de l’entreprise', async () => {
    const mock = serveur()
    expect(await actionCompte('delete', 'Éclat Mobile')).toEqual({ ok: true, data: null })
    expect(appel(mock)).toEqual({ url: '/api/account', method: 'POST', corps: { action: 'delete', confirm_name: 'Éclat Mobile' } })
  })

  it('suspendre ne demande pas de nom', async () => {
    const mock = serveur()
    await actionCompte('deactivate')
    expect(appel(mock).corps).toEqual({ action: 'deactivate' })
  })

  it('un nom qui ne correspond pas est un échec', async () => {
    serveur({ error: 'Le nom ne correspond pas' }, 400)
    expect((await actionCompte('delete', 'Autre')).ok).toBe(false)
  })
})

describe('envoyerSmsTest', () => {
  it('POST /api/test-sms, sans corps', async () => {
    const mock = serveur()
    expect(await envoyerSmsTest()).toEqual({ ok: true, data: null })
    expect(appel(mock)).toEqual({ url: '/api/test-sms', method: 'POST', corps: undefined })
  })

  it('une panne réseau est un échec', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    expect((await envoyerSmsTest()).ok).toBe(false)
  })
})

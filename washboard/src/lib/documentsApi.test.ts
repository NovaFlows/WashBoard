import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  lireDocuments, creerDocument, facturerDevis, repondreDevis, marquerPayee, envoyerDocument, supprimerDevis,
} from './documentsApi'
import type { SaisieDocument } from './documents'

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

describe('lireDocuments', () => {
  it('rend les documents', async () => {
    const documents = [{ id: 'd1' }]
    const mock = serveur({ documents })
    expect(await lireDocuments()).toEqual({ ok: true, data: documents })
    expect(mock.mock.calls[0][0]).toBe('/api/documents')
  })

  it('une réponse sans documents donne une liste vide', async () => {
    serveur({})
    expect(await lireDocuments()).toEqual({ ok: true, data: [] })
  })

  it('un corps illisible donne une liste vide', async () => {
    serveur(undefined)
    expect(await lireDocuments()).toEqual({ ok: true, data: [] })
  })

  it('un refus serveur donne une phrase claire', async () => {
    serveur({ error: 'x' }, 500)
    expect(await lireDocuments()).toEqual({ ok: false, message: 'Vos devis et factures n’ont pas pu être chargés. Réessayez.' })
  })

  it('une panne réseau parle de connexion', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const r = await lireDocuments()
    expect(!r.ok && r.message).toContain('connexion')
  })
})

describe('émissions : rendent le numéro attribué par le serveur', () => {
  it('créer un document envoie la saisie telle quelle', async () => {
    const saisie = { genre: 'devis' } as unknown as SaisieDocument
    const mock = serveur({ data: { id: 'd1', numero: 'D-00005' } })
    expect(await creerDocument(saisie)).toEqual({ ok: true, data: { id: 'd1', numero: 'D-00005' } })
    expect(appel(mock)).toEqual({ url: '/api/documents', method: 'POST', corps: { saisie } })
  })

  it('facturer un devis, y compris quand la facture existait déjà', async () => {
    const mock = serveur({ data: { id: 'f1', numero: 'F-00015', deja: true } })
    expect(await facturerDevis('d1')).toEqual({ ok: true, data: { id: 'f1', numero: 'F-00015', deja: true } })
    expect(appel(mock)).toEqual({ url: '/api/documents/d1/facturer', method: 'POST', corps: undefined })
  })

  it('une émission sans corps rend un objet vide plutôt que de planter', async () => {
    serveur({})
    expect(await facturerDevis('d1')).toEqual({ ok: true, data: {} })
  })

  it('un refus d’émission reste un échec', async () => {
    serveur({ error: 'Complétez vos mentions légales' }, 400)
    expect((await creerDocument({} as SaisieDocument)).ok).toBe(false)
  })
})

describe('actions sur un document', () => {
  const cas: [string, () => Promise<unknown>, string, string, unknown][] = [
    ['accepter un devis', () => repondreDevis('d1', 'accepte'), '/api/documents/d1', 'PATCH', { statut: 'accepte' }],
    ['refuser un devis', () => repondreDevis('d1', 'refuse'), '/api/documents/d1', 'PATCH', { statut: 'refuse' }],
    ['marquer payée', () => marquerPayee('f1', true), '/api/documents/f1', 'PATCH', { paye: true }],
    ['annuler « payée »', () => marquerPayee('f1', false), '/api/documents/f1', 'PATCH', { paye: false }],
    ['envoyer au client', () => envoyerDocument('d1'), '/api/documents/d1/envoyer', 'POST', undefined],
    ['supprimer un devis', () => supprimerDevis('d1'), '/api/documents/d1', 'DELETE', undefined],
  ]

  it.each(cas)('%s', async (_nom, action, url, method, corps) => {
    const mock = serveur()
    expect(await action()).toEqual({ ok: true, data: null })
    expect(appel(mock)).toEqual({ url, method, corps })
  })

  it('un refus remonte comme un échec', async () => {
    serveur({ error: 'Une facture ne se supprime pas' }, 409)
    expect((await supprimerDevis('f1')).ok).toBe(false)
  })
})

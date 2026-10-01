import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  creerPrestation, modifierPrestation, supprimerPrestation, creerCategorie, modifierCategorie, supprimerCategorie,
} from './prestationsApi'
import { FORMULAIRE_VIDE, type FormulairePrestation } from './prestationForm'
import { ERREUR_PRESTATION_RESERVEE, ERREUR_SANS_TYPE } from './prestation'

afterEach(() => vi.unstubAllGlobals())

const reponse = (status: number, corps?: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => { if (corps === undefined) throw new Error('vide'); return corps } }) as Response

const form: FormulairePrestation = {
  ...FORMULAIRE_VIDE, category_id: 'cat-1', name: 'Lavage', price: '80', duration_minutes: '90', vehicle_types: ['SUV'],
}

describe('creerPrestation', () => {
  it('POST /api/services avec le corps de la prestation, et rend la ligne créée', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reponse(200, { data: { id: 's-1', name: 'Lavage' } }))
    vi.stubGlobal('fetch', fetchMock)
    const r = await creerPrestation(form)
    expect(r).toEqual({ ok: true, data: { id: 's-1', name: 'Lavage' } })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/services')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toMatchObject({ category_id: 'cat-1', name: 'Lavage', price: 80, duration_minutes: 90, vehicle_types: ['SUV'], description: null })
  })

  it('un succès sans la ligne créée est un échec : pas de doublon si le laveur retente', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(200, {})))
    const r = await creerPrestation(form)
    expect(r.ok).toBe(false)
    expect(!r.ok && r.message).toContain('Rechargez')
  })

  it('un refus explicite porte le message du serveur', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(400, { error: ERREUR_SANS_TYPE })))
    expect(await creerPrestation(form)).toEqual({ ok: false, message: ERREUR_SANS_TYPE })
  })
})

describe('modifierPrestation', () => {
  it('PATCH /api/services/[id]', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reponse(200, { success: true }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await modifierPrestation('s-1', form)).toEqual({ ok: true, data: null })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/services/s-1')
    expect(fetchMock.mock.calls[0][1].method).toBe('PATCH')
  })
})

describe('supprimerPrestation', () => {
  it('DELETE sans corps ni en-tête JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reponse(200, { success: true }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await supprimerPrestation('s-1')).toEqual({ ok: true, data: null })
    expect(fetchMock).toHaveBeenCalledWith('/api/services/s-1', { method: 'DELETE' })
  })

  it('le refus « des réservations l’utilisent » (409) arrive tel quel au laveur', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(409, { error: ERREUR_PRESTATION_RESERVEE, errorId: 'abc' })))
    expect(await supprimerPrestation('s-1')).toEqual({ ok: false, message: ERREUR_PRESTATION_RESERVEE })
  })

  it('une panne réseau devient une phrase claire, propre à la suppression', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const r = await supprimerPrestation('s-1')
    expect(r).toEqual({ ok: false, message: expect.stringContaining('Suppression impossible') })
    expect(!r.ok && r.message).toContain('connexion')
  })

  it('une panne serveur n’expose pas son texte technique, seulement une référence', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(500, { error: 'duplicate key value violates…', errorId: '1234567890abcdef' })))
    const r = await supprimerPrestation('s-1')
    expect(r).toEqual({ ok: false, message: 'Suppression impossible. Réessayez dans un instant. (réf. 12345678)' })
  })

  it('une panne sans errorId : pas de référence inventée', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(500)))
    expect(await supprimerPrestation('s-1')).toEqual({ ok: false, message: 'Suppression impossible. Réessayez dans un instant.' })
  })

  it('une session expirée est nommée', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(401, { error: 'Non autorisé' })))
    const r = await supprimerPrestation('s-1')
    expect(!r.ok && r.message).toContain('session')
  })

  it('un 4xx au corps illisible retombe sur le message générique', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(400)))
    const r = await supprimerPrestation('s-1')
    expect(!r.ok && r.message).toContain('Réessayez')
  })
})

describe('catégories', () => {
  const types = [{ id: 'SUV', name: 'SUV / 4x4' }]

  it('création : POST avec nom, types et ordre, rend la catégorie', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reponse(200, { data: { id: 'c-1', name: 'Voiture', types } }))
    vi.stubGlobal('fetch', fetchMock)
    const r = await creerCategorie('Voiture', types, 2)
    expect(r).toEqual({ ok: true, data: { id: 'c-1', name: 'Voiture', types } })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/categories')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ name: 'Voiture', types, display_order: 2 })
  })

  it('création sans ligne renvoyée : échec', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(200, { data: null })))
    expect((await creerCategorie('Voiture', types, 0)).ok).toBe(false)
  })

  it('modification : PATCH avec nom et types seulement', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reponse(200, { success: true }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await modifierCategorie('c-1', 'Voiture', types)).toEqual({ ok: true, data: null })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/categories/c-1')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ name: 'Voiture', types })
  })

  it('suppression : DELETE', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reponse(200, { success: true }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await supprimerCategorie('c-1')).toEqual({ ok: true, data: null })
    expect(fetchMock).toHaveBeenCalledWith('/api/categories/c-1', { method: 'DELETE' })
  })

  it('un échec de modification est propagé (jamais un succès muet)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(500, { errorId: 'zzzzzzzzzz' })))
    const r = await modifierCategorie('c-1', 'V', types)
    expect(r).toEqual({ ok: false, message: 'Enregistrement impossible. Réessayez dans un instant. (réf. zzzzzzzz)' })
  })
})

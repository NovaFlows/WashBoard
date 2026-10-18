import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  marquerNePlusContacter, supprimerClient, modifierFiche, rattacherEntreprise,
  creerEntreprise, modifierEntreprise, supprimerEntreprise, ajouterSite, modifierSite, supprimerSite,
  listerTaches, creerTache, marquerTacheFaite, supprimerTache, fusionnerClients,
  enregistrerExport, anonymiserClient,
} from './clientsApi'

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

// La clé client contient un « @ » ou un « + » : elle doit être encodée dans l'URL.
const CLE = 'julie+test@exemple.fr'
const CLE_URL = encodeURIComponent(CLE)

describe('écritures : chaque action appelle la bonne route avec le bon corps', () => {
  const cas: [string, () => Promise<unknown>, string, string, unknown][] = [
    ['ne plus contacter', () => marquerNePlusContacter(CLE, true), `/api/clients/${CLE_URL}`, 'PATCH', { nePlusContacter: true }],
    ['supprimer un client (masquage)', () => supprimerClient(CLE), `/api/clients/${CLE_URL}`, 'DELETE', undefined],
    ['modifier la fiche', () => modifierFiche(CLE, { notes: 'Code portail 1234' }), `/api/clients/${CLE_URL}`, 'PATCH', { notes: 'Code portail 1234' }],
    ['rattacher à une entreprise', () => rattacherEntreprise(CLE, 'e1', 'Gérant'), `/api/clients/${CLE_URL}`, 'PATCH', { entrepriseId: 'e1', role: 'Gérant' }],
    ['détacher d’une entreprise', () => rattacherEntreprise(CLE, null, ''), `/api/clients/${CLE_URL}`, 'PATCH', { entrepriseId: null, role: '' }],
    ['modifier une entreprise', () => modifierEntreprise('e1', { nom: 'Garage Martin' }), '/api/entreprises/e1', 'PATCH', { nom: 'Garage Martin' }],
    ['supprimer une entreprise', () => supprimerEntreprise('e1'), '/api/entreprises/e1', 'DELETE', undefined],
    ['modifier un site', () => modifierSite('s1', '3 rue des Lilas', 'Parking B'), '/api/sites/s1', 'PATCH', { adresse: '3 rue des Lilas', note: 'Parking B' }],
    ['supprimer un site', () => supprimerSite('s1'), '/api/sites/s1', 'DELETE', undefined],
    ['cocher une tâche', () => marquerTacheFaite('t1', true), '/api/taches/t1', 'PATCH', { faite: true }],
    ['supprimer une tâche', () => supprimerTache('t1'), '/api/taches/t1', 'DELETE', undefined],
    ['fusionner deux fiches', () => fusionnerClients(CLE, 'julie@exemple.fr', '0612345678'), '/api/clients/fusionner', 'POST', { cleSource: CLE, emailCible: 'julie@exemple.fr', telephoneCible: '0612345678' }],
    ['journaliser un export RGPD', () => enregistrerExport(CLE), `/api/clients/${CLE_URL}/rgpd`, 'POST', { action: 'export' }],
    ['anonymiser un client', () => anonymiserClient(CLE), `/api/clients/${CLE_URL}/rgpd`, 'POST', { action: 'anonymiser' }],
  ]

  it.each(cas)('%s', async (_nom, action, url, method, corps) => {
    const mock = serveur()
    expect(await action()).toEqual({ ok: true, data: null })
    expect(appel(mock)).toEqual({ url, method, corps })
  })

  it('un refus du serveur remonte tel quel, sans transformer l’échec en succès', async () => {
    serveur({ error: 'Entreprise introuvable' }, 404)
    const r = await supprimerEntreprise('e1')
    expect(r.ok).toBe(false)
  })
})

describe('créations : rendent l’identifiant créé', () => {
  it('créer une entreprise', async () => {
    const mock = serveur({ data: { id: 'e9' } })
    expect(await creerEntreprise('Garage Martin', 30)).toEqual({ ok: true, data: { id: 'e9' } })
    expect(appel(mock)).toEqual({ url: '/api/entreprises', method: 'POST', corps: { nom: 'Garage Martin', delaiPaiementJours: 30 } })
  })

  it('ajouter un site', async () => {
    const mock = serveur({ data: { id: 's9' } })
    expect(await ajouterSite('e1', '3 rue des Lilas', '')).toEqual({ ok: true, data: { id: 's9' } })
    expect(appel(mock)).toEqual({ url: '/api/entreprises/e1/sites', method: 'POST', corps: { adresse: '3 rue des Lilas', note: '' } })
  })

  it('une création sans corps rend un objet vide plutôt que de planter', async () => {
    serveur({})
    expect(await creerEntreprise('Garage Martin', null)).toEqual({ ok: true, data: {} })
  })

  it('créer une tâche rend la tâche', async () => {
    const tache = { id: 't9', texte: 'Rappeler', faiteLe: null, creeLe: '2026-10-17T10:00:00Z' }
    const mock = serveur({ data: tache })
    expect(await creerTache(CLE, 'Rappeler')).toEqual({ ok: true, data: tache })
    expect(appel(mock)).toEqual({ url: `/api/clients/${CLE_URL}/taches`, method: 'POST', corps: { texte: 'Rappeler' } })
  })

  it('un échec de création reste un échec', async () => {
    serveur({ error: 'Nom requis' }, 400)
    expect((await ajouterSite('e1', '', '')).ok).toBe(false)
  })
})

describe('listerTaches', () => {
  it('GET sur la clé encodée, rend les tâches', async () => {
    const taches = [{ id: 't1', texte: 'Rappeler', faiteLe: null, creeLe: '2026-10-17T10:00:00Z' }]
    const mock = serveur({ taches })
    expect(await listerTaches(CLE)).toEqual({ ok: true, data: taches })
    expect(mock.mock.calls[0][0]).toBe(`/api/clients/${CLE_URL}/taches`)
  })

  it('une réponse sans tâches donne une liste vide', async () => {
    serveur({})
    expect(await listerTaches(CLE)).toEqual({ ok: true, data: [] })
  })

  it('un corps illisible donne une liste vide', async () => {
    serveur(undefined)
    expect(await listerTaches(CLE)).toEqual({ ok: true, data: [] })
  })

  it('un refus serveur donne une phrase claire', async () => {
    serveur({ error: 'x' }, 500)
    expect(await listerTaches(CLE)).toEqual({ ok: false, message: 'Les tâches n’ont pas pu être chargées. Réessayez.' })
  })

  it('une panne réseau parle de connexion', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const r = await listerTaches(CLE)
    expect(!r.ok && r.message).toContain('connexion')
  })
})

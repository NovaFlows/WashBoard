import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  lireDepenses, lireRecurrents, ajouterDepense, supprimerDepense, ajouterRecurrent, basculerRecurrent, supprimerRecurrent,
} from './depensesApi'

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

const panne = () => vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

describe('lireDepenses', () => {
  it('demande la période, bornes encodées', async () => {
    const expenses = [{ id: 'x1' }]
    const mock = serveur({ expenses })
    expect(await lireDepenses('2026-10-01', '2026-10-31')).toEqual({ ok: true, data: expenses })
    expect(mock.mock.calls[0][0]).toBe('/api/expenses?start=2026-10-01&end=2026-10-31')
  })

  it('une réponse sans frais donne une liste vide', async () => {
    serveur({})
    expect(await lireDepenses('2026-10-01', '2026-10-31')).toEqual({ ok: true, data: [] })
  })

  it('un corps illisible donne une liste vide', async () => {
    serveur(undefined)
    expect(await lireDepenses('2026-10-01', '2026-10-31')).toEqual({ ok: true, data: [] })
  })

  it('un refus serveur donne une phrase claire', async () => {
    serveur({ error: 'x' }, 500)
    expect(await lireDepenses('2026-10-01', '2026-10-31')).toEqual({ ok: false, message: 'Vos frais n’ont pas pu être chargés. Réessayez.' })
  })

  it('une panne réseau parle de connexion', async () => {
    panne()
    const r = await lireDepenses('2026-10-01', '2026-10-31')
    expect(!r.ok && r.message).toContain('connexion')
  })
})

describe('lireRecurrents', () => {
  it('rend les frais récurrents', async () => {
    const recurring = [{ id: 'r1' }]
    const mock = serveur({ recurring })
    expect(await lireRecurrents()).toEqual({ ok: true, data: recurring })
    expect(mock.mock.calls[0][0]).toBe('/api/expenses/recurring')
  })

  it('une réponse sans frais récurrents donne une liste vide', async () => {
    serveur(undefined)
    expect(await lireRecurrents()).toEqual({ ok: true, data: [] })
  })

  it('un refus serveur donne une phrase claire', async () => {
    serveur({ error: 'x' }, 500)
    expect(await lireRecurrents()).toEqual({ ok: false, message: 'Vos frais récurrents n’ont pas pu être chargés. Réessayez.' })
  })

  it('une panne réseau parle de connexion', async () => {
    panne()
    const r = await lireRecurrents()
    expect(!r.ok && r.message).toContain('connexion')
  })
})

describe('écritures', () => {
  const depense = { date: '2026-10-17', category: 'carburant', label: 'Plein', amount: 72.5 }
  const recurrent = { category: 'assurance', label: 'RC Pro', amount: 39, day_of_month: 5 }
  const cas: [string, () => Promise<unknown>, string, string, unknown][] = [
    ['ajouter une dépense', () => ajouterDepense(depense), '/api/expenses', 'POST', depense],
    ['supprimer une dépense', () => supprimerDepense('x1'), '/api/expenses/x1', 'DELETE', undefined],
    ['ajouter un frais récurrent', () => ajouterRecurrent(recurrent), '/api/expenses/recurring', 'POST', recurrent],
    ['mettre en pause un frais récurrent', () => basculerRecurrent('r1', false), '/api/expenses/recurring/r1', 'PATCH', { active: false }],
    ['supprimer un frais récurrent', () => supprimerRecurrent('r1'), '/api/expenses/recurring/r1', 'DELETE', undefined],
  ]

  it.each(cas)('%s', async (_nom, action, url, method, corps) => {
    const mock = serveur()
    expect(await action()).toEqual({ ok: true, data: null })
    expect(appel(mock)).toEqual({ url, method, corps })
  })

  it('un refus remonte comme un échec', async () => {
    serveur({ error: 'Montant invalide' }, 400)
    expect((await ajouterDepense({ ...depense, amount: -1 })).ok).toBe(false)
  })
})

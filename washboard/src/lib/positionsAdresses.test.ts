import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// La mémoire de la page vit au niveau du module : on la remet à zéro à chaque test.
let localiser: typeof import('./positionsAdresses').localiser
let positionConnue: typeof import('./positionsAdresses').positionConnue

beforeEach(async () => {
  vi.resetModules()
  const m = await import('./positionsAdresses')
  localiser = m.localiser
  positionConnue = m.positionConnue
})
afterEach(() => vi.unstubAllGlobals())

const reponse = (corps: unknown, statut = 200, entetes: Record<string, string> = {}) =>
  new Response(JSON.stringify(corps), { status: statut, headers: entetes })

describe('localiser', () => {
  it('demande une fois, puis répond de mémoire (casse et espaces ignorés)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reponse({ lat: 49.06, lng: 2.17 }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await localiser('1 Rue A, Méry')).toEqual({ lat: 49.06, lng: 2.17 })
    expect(await localiser('  1 rue a,   MÉRY ')).toEqual({ lat: 49.06, lng: 2.17 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(positionConnue('1 rue a, méry')).toEqual({ lat: 49.06, lng: 2.17 })
  })

  it('retient un « introuvable » (null) : jamais redemandé', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reponse({ lat: null, lng: null }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await localiser('nulle part')).toBeNull()
    expect(await localiser('nulle part')).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('ne retient JAMAIS un échec : la route en panne pourra être retentée', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(reponse({ error: 'x' }, 503))
      .mockRejectedValueOnce(new Error('réseau'))
      .mockResolvedValueOnce(reponse({ lat: 48.9, lng: 2.3 }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await localiser('adresse')).toBeUndefined()
    expect(await localiser('adresse')).toBeUndefined()
    expect(positionConnue('adresse')).toBeUndefined()
    expect(await localiser('adresse')).toEqual({ lat: 48.9, lng: 2.3 })
  })

  it("après un plafond (429), n'insiste pas avant l'heure indiquée", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reponse({ error: 'trop' }, 429, { 'Retry-After': '120' }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await localiser('a')).toBeUndefined()
    expect(await localiser('b')).toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('deux demandes simultanées pour la même adresse partagent une seule requête', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reponse({ lat: 1, lng: 2 }))
    vi.stubGlobal('fetch', fetchMock)
    const [a, b] = await Promise.all([localiser('x'), localiser('X')])
    expect(a).toEqual(b)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

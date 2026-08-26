import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Le logger est mocké : ce qu'on veut vérifier, c'est précisément QU'IL EST
// APPELÉ. C'est l'absence de cet appel qui a laissé une panne de facturation
// Google passer pour « pas de suggestions » pendant neuf jours.
const errors: { event: string; ctx: unknown }[] = []
vi.mock('@/lib/logger', () => ({
  logger: {
    error: (event: string, ctx: unknown) => { errors.push({ event, ctx }) },
    warn: () => {},
    info: () => {},
  },
}))

const { fetchGoogleMaps, getMapsApiKey } = await import('./googleMaps')

function repond(body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => body })))
}

beforeEach(() => {
  errors.length = 0
  vi.unstubAllEnvs()
  vi.stubEnv('GOOGLE_MAPS_API_KEY', 'cle-test')
})
afterEach(() => vi.unstubAllGlobals())

describe('getMapsApiKey', () => {
  it('préfère le nouveau nom', () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', 'ancienne')
    expect(getMapsApiKey()).toBe('cle-test')
  })
  it('retombe sur l’ancien nom, pour survivre au renommage côté Vercel', () => {
    vi.stubEnv('GOOGLE_MAPS_API_KEY', '')
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', 'ancienne')
    expect(getMapsApiKey()).toBe('ancienne')
  })
})

describe('fetchGoogleMaps', () => {
  it('renvoie les données quand Google répond OK', async () => {
    repond({ status: 'OK', predictions: [1, 2] })
    const d = await fetchGoogleMaps<{ status: string; predictions: number[] }>('https://x?a=1', 'test')
    expect(d?.predictions).toEqual([1, 2])
    expect(errors).toHaveLength(0)
  })

  it('ne signale pas ZERO_RESULTS : c’est une absence de résultat, pas une panne', async () => {
    repond({ status: 'ZERO_RESULTS' })
    const d = await fetchGoogleMaps('https://x?a=1', 'test')
    expect(d).not.toBeNull()
    expect(errors).toHaveLength(0)
  })

  it('signale REQUEST_DENIED — le cas exact de la facturation désactivée', async () => {
    repond({ status: 'REQUEST_DENIED', error_message: 'You must enable Billing' })
    const d = await fetchGoogleMaps('https://x?a=1', 'places.autocomplete')
    expect(d).toBeNull()
    expect(errors).toHaveLength(1)
    expect(errors[0].event).toBe('places.autocomplete.google_error')
    expect(errors[0].ctx).toMatchObject({ status: 'REQUEST_DENIED' })
  })

  it('signale aussi OVER_QUERY_LIMIT', async () => {
    repond({ status: 'OVER_QUERY_LIMIT' })
    expect(await fetchGoogleMaps('https://x?a=1', 'test')).toBeNull()
    expect(errors[0].event).toBe('test.google_error')
  })

  it('signale une clé absente', async () => {
    vi.stubEnv('GOOGLE_MAPS_API_KEY', '')
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', '')
    expect(await fetchGoogleMaps('https://x?a=1', 'test')).toBeNull()
    expect(errors[0].event).toBe('test.no_api_key')
  })

  it('signale une panne réseau', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('réseau') }))
    expect(await fetchGoogleMaps('https://x?a=1', 'test')).toBeNull()
    expect(errors[0].event).toBe('test.fetch_failed')
  })

  it('ajoute la clé à l’URL', async () => {
    const spy = vi.fn(async (_url: string) => ({ json: async () => ({ status: 'OK' }) }))
    vi.stubGlobal('fetch', spy)
    await fetchGoogleMaps('https://x?a=1', 'test')
    expect(String(spy.mock.calls[0][0])).toContain('key=cle-test')
  })
})

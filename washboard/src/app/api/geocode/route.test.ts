import { describe, it, expect, vi, beforeEach } from 'vitest'

// Route de géocodage du filtre de distance : chaque appel qui atteint Google est facturé,
// on vérifie donc surtout ce qui évite de l'atteindre (session, validation, cache) et qu'un
// « introuvable » ne devienne jamais une erreur.

let utilisateur: unknown
const fetchGoogleMaps = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: utilisateur } }) } }),
}))
vi.mock('@/lib/googleMaps', () => ({ fetchGoogleMaps: (...args: unknown[]) => fetchGoogleMaps(...args) }))

const { GET } = await import('./route')

let n = 0
const adresseUnique = () => `${++n} Rue des Tests, Eaubonne, France`
const requete = (address?: string) => {
  const url = new URL('https://www.washboard.fr/api/geocode')
  if (address !== undefined) url.searchParams.set('address', address)
  return new Request(url)
}
const ok = (lat: number, lng: number) => ({ status: 'OK', results: [{ geometry: { location: { lat, lng } } }] })

beforeEach(() => {
  fetchGoogleMaps.mockReset()
  utilisateur = { id: `user-${++n}` }
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

describe('GET /api/geocode', () => {
  it('refuse sans session (401) sans solliciter Google', async () => {
    utilisateur = null
    expect((await GET(requete(adresseUnique()))).status).toBe(401)
    expect(fetchGoogleMaps).not.toHaveBeenCalled()
  })

  it('refuse une adresse absente, vide ou trop longue (400)', async () => {
    expect((await GET(requete())).status).toBe(400)
    expect((await GET(requete('   '))).status).toBe(400)
    expect((await GET(requete('a'.repeat(201)))).status).toBe(400)
    expect(fetchGoogleMaps).not.toHaveBeenCalled()
  })

  it('rend la position et ne redemande pas la même adresse', async () => {
    fetchGoogleMaps.mockResolvedValue(ok(49.06, 2.17))
    const a = adresseUnique()
    expect(await (await GET(requete(a))).json()).toEqual({ lat: 49.06, lng: 2.17 })
    expect(await (await GET(requete(`  ${a.toUpperCase()} `))).json()).toEqual({ lat: 49.06, lng: 2.17 })
    expect(fetchGoogleMaps).toHaveBeenCalledTimes(1)
  })

  it('rend « introuvable » (200, coordonnées nulles) et le retient', async () => {
    fetchGoogleMaps.mockResolvedValue({ status: 'ZERO_RESULTS', results: [] })
    const a = adresseUnique()
    const res = await GET(requete(a))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ lat: null, lng: null })
    await GET(requete(a))
    expect(fetchGoogleMaps).toHaveBeenCalledTimes(1)
  })

  it('une panne Google est « introuvable » sans cache : la suivante réessaie', async () => {
    fetchGoogleMaps.mockResolvedValueOnce(null).mockResolvedValueOnce(ok(48.9, 2.3))
    const a = adresseUnique()
    expect(await (await GET(requete(a))).json()).toEqual({ lat: null, lng: null })
    expect(await (await GET(requete(a))).json()).toEqual({ lat: 48.9, lng: 2.3 })
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Route de géocodage de l'agenda : chaque appel qui atteint Google est facturé,
// donc on vérifie surtout ce qui évite de l'atteindre (session, validation,
// cache, plafond) et qu'un « introuvable » ne devienne jamais une erreur 500.

let utilisateur: unknown
const fetchGoogleMaps = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: utilisateur } }) } }),
}))
vi.mock('@/lib/googleMaps', () => ({ fetchGoogleMaps: (...args: unknown[]) => fetchGoogleMaps(...args) }))

const { GET } = await import('./route')

// Adresses et identifiants uniques par test : le cache et le compteur de la
// route vivent au niveau du module et survivent d'un test à l'autre.
let n = 0
const adresseUnique = () => `${++n} Rue des Tests, Eaubonne, France`

function requete(address?: string) {
  const url = new URL('https://www.washboard.fr/api/geocode')
  if (address !== undefined) url.searchParams.set('address', address)
  return new Request(url)
}

const reponseGoogle = (lat: number, lng: number) => ({ status: 'OK', results: [{ geometry: { location: { lat, lng } } }] })

beforeEach(() => {
  fetchGoogleMaps.mockReset()
  utilisateur = { id: `user-${++n}` }
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
})

describe('GET /api/geocode — accès et validation', () => {
  it('refuse sans session (401) sans solliciter Google', async () => {
    utilisateur = null
    const res = await GET(requete(adresseUnique()))
    expect(res.status).toBe(401)
    expect(fetchGoogleMaps).not.toHaveBeenCalled()
  })

  it('refuse une adresse absente (400)', async () => {
    const res = await GET(requete())
    expect(res.status).toBe(400)
    expect(fetchGoogleMaps).not.toHaveBeenCalled()
  })

  it('refuse une adresse vide ou faite d’espaces (400)', async () => {
    expect((await GET(requete('   '))).status).toBe(400)
    expect(fetchGoogleMaps).not.toHaveBeenCalled()
  })

  it('refuse une adresse de plus de 200 caractères (400) et accepte exactement 200', async () => {
    const res = await GET(requete('a'.repeat(201)))
    expect(res.status).toBe(400)
    expect(fetchGoogleMaps).not.toHaveBeenCalled()

    fetchGoogleMaps.mockResolvedValue(reponseGoogle(1, 2))
    expect((await GET(requete('b'.repeat(200)))).status).toBe(200)
  })
})

describe('GET /api/geocode — résultat', () => {
  it('renvoie les coordonnées trouvées par Google', async () => {
    fetchGoogleMaps.mockResolvedValue(reponseGoogle(48.9895, 2.2764))
    const adresse = adresseUnique()
    const res = await GET(requete(adresse))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ lat: 48.9895, lng: 2.2764 })

    // Réutilise l'accès centralisé, avec l'adresse encodée dans l'URL.
    const [url, event] = fetchGoogleMaps.mock.calls[0]
    expect(url).toContain('/geocode/json?address=' + encodeURIComponent(adresse))
    expect(event).toBe('geocode')
  })

  it('renvoie des coordonnées nulles (200) quand l’adresse est introuvable', async () => {
    fetchGoogleMaps.mockResolvedValue({ status: 'ZERO_RESULTS', results: [] })
    const res = await GET(requete(adresseUnique()))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ lat: null, lng: null })
  })

  it('renvoie des coordonnées nulles (200) quand Google est en panne, sans mettre la panne en cache', async () => {
    const adresse = adresseUnique()
    fetchGoogleMaps.mockResolvedValueOnce(null)
    const panne = await GET(requete(adresse))
    expect(panne.status).toBe(200)
    expect(await panne.json()).toEqual({ lat: null, lng: null })

    // Google revient : l'adresse doit être réessayée, pas figée en « introuvable ».
    fetchGoogleMaps.mockResolvedValueOnce(reponseGoogle(10, 20))
    const retablie = await GET(requete(adresse))
    expect(await retablie.json()).toEqual({ lat: 10, lng: 20 })
    expect(fetchGoogleMaps).toHaveBeenCalledTimes(2)
  })

  it('ignore une localisation non numérique', async () => {
    fetchGoogleMaps.mockResolvedValue({ status: 'OK', results: [{ geometry: { location: { lat: 'x', lng: null } } }] })
    const res = await GET(requete(adresseUnique()))
    expect(await res.json()).toEqual({ lat: null, lng: null })
  })
})

describe('GET /api/geocode — cache', () => {
  it('ne sollicite pas Google une seconde fois pour la même adresse, même écrite autrement', async () => {
    fetchGoogleMaps.mockResolvedValue(reponseGoogle(48.9, 2.3))
    const adresse = adresseUnique()
    const premiere = await GET(requete(adresse))
    const seconde = await GET(requete(`  ${adresse.toUpperCase().replace(/ /g, '  ')} `))
    expect(await premiere.json()).toEqual({ lat: 48.9, lng: 2.3 })
    expect(await seconde.json()).toEqual({ lat: 48.9, lng: 2.3 })
    expect(fetchGoogleMaps).toHaveBeenCalledTimes(1)
  })

  it('met aussi en cache un « introuvable »', async () => {
    fetchGoogleMaps.mockResolvedValue({ status: 'ZERO_RESULTS', results: [] })
    const adresse = adresseUnique()
    await GET(requete(adresse))
    const seconde = await GET(requete(adresse))
    expect(await seconde.json()).toEqual({ lat: null, lng: null })
    expect(fetchGoogleMaps).toHaveBeenCalledTimes(1)
  })

  it('partage le cache entre utilisateurs', async () => {
    fetchGoogleMaps.mockResolvedValue(reponseGoogle(1, 1))
    const adresse = adresseUnique()
    await GET(requete(adresse))
    utilisateur = { id: `user-${++n}` }
    await GET(requete(adresse))
    expect(fetchGoogleMaps).toHaveBeenCalledTimes(1)
  })

  it('expire après 24 h', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-24T10:00:00Z'))
    fetchGoogleMaps.mockResolvedValue(reponseGoogle(1, 1))
    const adresse = adresseUnique()

    await GET(requete(adresse))
    vi.setSystemTime(new Date('2026-09-25T09:59:00Z'))
    await GET(requete(adresse))
    expect(fetchGoogleMaps).toHaveBeenCalledTimes(1)

    vi.setSystemTime(new Date('2026-09-25T10:01:00Z'))
    await GET(requete(adresse))
    expect(fetchGoogleMaps).toHaveBeenCalledTimes(2)
  })

  it('reste borné : les entrées les plus anciennes sont évincées', async () => {
    fetchGoogleMaps.mockResolvedValue(reponseGoogle(1, 1))
    const premiere = adresseUnique()
    await GET(requete(premiere))

    // 600 autres adresses (le cache est déjà un peu rempli), réparties sur plusieurs utilisateurs pour ne pas
    // buter sur le plafond de 60 appels.
    for (let i = 0; i < 600; i++) {
      if (i % 50 === 0) utilisateur = { id: `user-${++n}` }
      await GET(requete(adresseUnique()))
    }
    fetchGoogleMaps.mockClear()

    utilisateur = { id: `user-${++n}` }
    await GET(requete(premiere))
    expect(fetchGoogleMaps).toHaveBeenCalledTimes(1)
  })
})

describe('GET /api/geocode — plafond par utilisateur', () => {
  it('refuse au-delà de 60 appels vers Google (429 + Retry-After) sans les solliciter', async () => {
    fetchGoogleMaps.mockResolvedValue(reponseGoogle(1, 1))
    for (let i = 0; i < 60; i++) {
      expect((await GET(requete(adresseUnique()))).status).toBe(200)
    }
    const res = await GET(requete(adresseUnique()))
    expect(res.status).toBe(429)
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0)
    expect(fetchGoogleMaps).toHaveBeenCalledTimes(60)
  })

  it('ne compte pas les réponses servies par le cache', async () => {
    fetchGoogleMaps.mockResolvedValue(reponseGoogle(1, 1))
    const adresse = adresseUnique()
    for (let i = 0; i < 100; i++) {
      expect((await GET(requete(adresse))).status).toBe(200)
    }
    expect(fetchGoogleMaps).toHaveBeenCalledTimes(1)
  })

  it('le plafond d’un utilisateur ne bloque pas les autres', async () => {
    fetchGoogleMaps.mockResolvedValue(reponseGoogle(1, 1))
    for (let i = 0; i < 61; i++) await GET(requete(adresseUnique()))
    utilisateur = { id: `user-${++n}` }
    expect((await GET(requete(adresseUnique()))).status).toBe(200)
  })
})

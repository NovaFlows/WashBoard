import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Route de trajet de l'agenda : chaque appel qui atteint Google est facturé,
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

function requete(from?: string, to?: string) {
  const url = new URL('https://www.washboard.fr/api/trajet')
  if (from !== undefined) url.searchParams.set('from', from)
  if (to !== undefined) url.searchParams.set('to', to)
  return new Request(url)
}

const reponseGoogle = (secondes: number, metres: number) => ({
  status: 'OK',
  rows: [{ elements: [{ status: 'OK', duration: { value: secondes }, distance: { value: metres } }] }],
})

const NUL = { minutes: null, km: null }

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

describe('GET /api/trajet — accès et validation', () => {
  it('refuse sans session (401) sans solliciter Google', async () => {
    utilisateur = null
    const res = await GET(requete(adresseUnique(), adresseUnique()))
    expect(res.status).toBe(401)
    expect(fetchGoogleMaps).not.toHaveBeenCalled()
  })

  it('refuse un paramètre absent (400)', async () => {
    expect((await GET(requete())).status).toBe(400)
    expect((await GET(requete(adresseUnique()))).status).toBe(400)
    expect((await GET(requete(undefined, adresseUnique()))).status).toBe(400)
    expect(fetchGoogleMaps).not.toHaveBeenCalled()
  })

  it('refuse une adresse vide ou faite d’espaces (400)', async () => {
    expect((await GET(requete('   ', adresseUnique()))).status).toBe(400)
    expect((await GET(requete(adresseUnique(), ''))).status).toBe(400)
    expect(fetchGoogleMaps).not.toHaveBeenCalled()
  })

  it('refuse une adresse de plus de 200 caractères (400) et accepte exactement 200', async () => {
    expect((await GET(requete('a'.repeat(201), adresseUnique()))).status).toBe(400)
    expect((await GET(requete(adresseUnique(), 'a'.repeat(201)))).status).toBe(400)
    expect(fetchGoogleMaps).not.toHaveBeenCalled()

    fetchGoogleMaps.mockResolvedValue(reponseGoogle(600, 5000))
    expect((await GET(requete('b'.repeat(200), 'c'.repeat(200)))).status).toBe(200)
  })
})

describe('GET /api/trajet — résultat', () => {
  it('renvoie la durée en minutes arrondies et la distance en km à une décimale', async () => {
    // 1 380 s = 23 min ; 14 640 m = 14,6 km
    fetchGoogleMaps.mockResolvedValue(reponseGoogle(1380, 14640))
    const from = adresseUnique()
    const to = adresseUnique()
    const res = await GET(requete(from, to))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ minutes: 23, km: 14.6 })

    // Un seul appel Google, en voiture, avec les deux adresses encodées.
    expect(fetchGoogleMaps).toHaveBeenCalledTimes(1)
    const [url, event] = fetchGoogleMaps.mock.calls[0]
    expect(url).toContain('/distancematrix/json?')
    expect(url).toContain('origins=' + encodeURIComponent(from))
    expect(url).toContain('destinations=' + encodeURIComponent(to))
    expect(url).toContain('mode=driving')
    expect(event).toBe('trajet')
  })

  it('arrondit la durée à la minute la plus proche', async () => {
    fetchGoogleMaps.mockResolvedValue(reponseGoogle(89, 950))
    const res = await GET(requete(adresseUnique(), adresseUnique()))
    expect(await res.json()).toEqual({ minutes: 1, km: 1 })
  })

  it('renvoie des valeurs nulles (200) quand Google ne trouve pas l’itinéraire', async () => {
    fetchGoogleMaps.mockResolvedValue({ status: 'OK', rows: [{ elements: [{ status: 'NOT_FOUND' }] }] })
    const res = await GET(requete(adresseUnique(), adresseUnique()))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(NUL)
  })

  it('renvoie des valeurs nulles (200) quand la réponse est vide ou incomplète', async () => {
    fetchGoogleMaps.mockResolvedValueOnce({ status: 'ZERO_RESULTS', rows: [] })
    expect(await (await GET(requete(adresseUnique(), adresseUnique()))).json()).toEqual(NUL)

    fetchGoogleMaps.mockResolvedValueOnce({ status: 'OK', rows: [{ elements: [{ status: 'OK', duration: { value: 'x' }, distance: { value: null } }] }] })
    expect(await (await GET(requete(adresseUnique(), adresseUnique()))).json()).toEqual(NUL)
  })

  it('renvoie des valeurs nulles (200) quand Google est en panne, sans mettre la panne en cache', async () => {
    const from = adresseUnique()
    const to = adresseUnique()
    fetchGoogleMaps.mockResolvedValueOnce(null)
    const panne = await GET(requete(from, to))
    expect(panne.status).toBe(200)
    expect(await panne.json()).toEqual(NUL)

    // Google revient : la paire doit être réessayée, pas figée en « introuvable ».
    fetchGoogleMaps.mockResolvedValueOnce(reponseGoogle(600, 5000))
    const retablie = await GET(requete(from, to))
    expect(await retablie.json()).toEqual({ minutes: 10, km: 5 })
    expect(fetchGoogleMaps).toHaveBeenCalledTimes(2)
  })
})

describe('GET /api/trajet — cache', () => {
  it('ne sollicite pas Google une seconde fois pour la même paire, même écrite autrement', async () => {
    fetchGoogleMaps.mockResolvedValue(reponseGoogle(600, 5000))
    const from = adresseUnique()
    const to = adresseUnique()
    const premiere = await GET(requete(from, to))
    const seconde = await GET(requete(`  ${from.toUpperCase().replace(/ /g, '  ')} `, to.toUpperCase()))
    expect(await premiere.json()).toEqual({ minutes: 10, km: 5 })
    expect(await seconde.json()).toEqual({ minutes: 10, km: 5 })
    expect(fetchGoogleMaps).toHaveBeenCalledTimes(1)
  })

  it('distingue le sens du trajet et les paires différentes', async () => {
    fetchGoogleMaps.mockResolvedValue(reponseGoogle(600, 5000))
    const a = adresseUnique()
    const b = adresseUnique()
    await GET(requete(a, b))
    await GET(requete(b, a))
    await GET(requete(a, adresseUnique()))
    expect(fetchGoogleMaps).toHaveBeenCalledTimes(3)
  })

  it('met aussi en cache un « introuvable »', async () => {
    fetchGoogleMaps.mockResolvedValue({ status: 'OK', rows: [{ elements: [{ status: 'ZERO_RESULTS' }] }] })
    const from = adresseUnique()
    const to = adresseUnique()
    await GET(requete(from, to))
    const seconde = await GET(requete(from, to))
    expect(await seconde.json()).toEqual(NUL)
    expect(fetchGoogleMaps).toHaveBeenCalledTimes(1)
  })

  it('partage le cache entre utilisateurs', async () => {
    fetchGoogleMaps.mockResolvedValue(reponseGoogle(600, 5000))
    const from = adresseUnique()
    const to = adresseUnique()
    await GET(requete(from, to))
    utilisateur = { id: `user-${++n}` }
    await GET(requete(from, to))
    expect(fetchGoogleMaps).toHaveBeenCalledTimes(1)
  })

  it('expire après 24 h', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-24T10:00:00Z'))
    fetchGoogleMaps.mockResolvedValue(reponseGoogle(600, 5000))
    const from = adresseUnique()
    const to = adresseUnique()

    await GET(requete(from, to))
    vi.setSystemTime(new Date('2026-09-25T09:59:00Z'))
    await GET(requete(from, to))
    expect(fetchGoogleMaps).toHaveBeenCalledTimes(1)

    vi.setSystemTime(new Date('2026-09-25T10:01:00Z'))
    await GET(requete(from, to))
    expect(fetchGoogleMaps).toHaveBeenCalledTimes(2)
  })

  it('reste borné : les entrées les plus anciennes sont évincées', async () => {
    fetchGoogleMaps.mockResolvedValue(reponseGoogle(600, 5000))
    const from = adresseUnique()
    const to = adresseUnique()
    await GET(requete(from, to))

    // 600 autres paires, réparties sur plusieurs utilisateurs pour ne pas
    // buter sur le plafond de 60 appels.
    for (let i = 0; i < 600; i++) {
      if (i % 50 === 0) utilisateur = { id: `user-${++n}` }
      await GET(requete(adresseUnique(), adresseUnique()))
    }
    fetchGoogleMaps.mockClear()

    utilisateur = { id: `user-${++n}` }
    await GET(requete(from, to))
    expect(fetchGoogleMaps).toHaveBeenCalledTimes(1)
  })
})

describe('GET /api/trajet — plafond par utilisateur', () => {
  it('refuse au-delà de 60 appels vers Google (429 + Retry-After) sans les solliciter', async () => {
    fetchGoogleMaps.mockResolvedValue(reponseGoogle(600, 5000))
    for (let i = 0; i < 60; i++) {
      expect((await GET(requete(adresseUnique(), adresseUnique()))).status).toBe(200)
    }
    const res = await GET(requete(adresseUnique(), adresseUnique()))
    expect(res.status).toBe(429)
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0)
    expect(fetchGoogleMaps).toHaveBeenCalledTimes(60)
  })

  it('ne compte pas les réponses servies par le cache', async () => {
    fetchGoogleMaps.mockResolvedValue(reponseGoogle(600, 5000))
    const from = adresseUnique()
    const to = adresseUnique()
    for (let i = 0; i < 100; i++) {
      expect((await GET(requete(from, to))).status).toBe(200)
    }
    expect(fetchGoogleMaps).toHaveBeenCalledTimes(1)
  })

  it('le plafond d’un utilisateur ne bloque pas les autres', async () => {
    fetchGoogleMaps.mockResolvedValue(reponseGoogle(600, 5000))
    for (let i = 0; i < 61; i++) await GET(requete(adresseUnique(), adresseUnique()))
    utilisateur = { id: `user-${++n}` }
    expect((await GET(requete(adresseUnique(), adresseUnique()))).status).toBe(200)
  })
})

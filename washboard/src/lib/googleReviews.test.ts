import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const fetchGoogleMaps = vi.fn()
vi.mock('@/lib/googleMaps', () => ({ fetchGoogleMaps: (...args: unknown[]) => fetchGoogleMaps(...args) }))

const { isPublicHttpUrl, scrapeWebsiteReviews, fetchGooglePlaceRating, reviewsForWasher } = await import('./googleReviews')

function pageAvecHtml(html: string) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => html })))
}

beforeEach(() => { fetchGoogleMaps.mockReset() })
afterEach(() => vi.unstubAllGlobals())

// Ce champ est rempli librement par le laveur et récupéré par NOTRE serveur :
// il pouvait servir à sonder ce qui n'est pas accessible depuis l'extérieur.

describe('isPublicHttpUrl', () => {
  it('accepte un vrai site', () => {
    expect(isPublicHttpUrl('https://kookiiclean.fr')).toBe(true)
    expect(isPublicHttpUrl('http://exemple.fr/avis')).toBe(true)
  })

  it('refuse la boucle locale', () => {
    expect(isPublicHttpUrl('http://localhost:3000/api/health')).toBe(false)
    expect(isPublicHttpUrl('http://127.0.0.1/')).toBe(false)
    expect(isPublicHttpUrl('http://[::1]/')).toBe(false)
  })

  it('refuse les adresses du réseau interne', () => {
    expect(isPublicHttpUrl('http://10.0.0.5/')).toBe(false)
    expect(isPublicHttpUrl('http://192.168.1.1/')).toBe(false)
    expect(isPublicHttpUrl('http://172.16.0.1/')).toBe(false)
    expect(isPublicHttpUrl('http://172.31.255.1/')).toBe(false)
  })

  it('refuse les métadonnées de l’hébergeur', () => {
    // La cible classique de ce type d'attaque : elles exposent des jetons.
    expect(isPublicHttpUrl('http://169.254.169.254/latest/meta-data/')).toBe(false)
    expect(isPublicHttpUrl('http://metadata.google.internal/')).toBe(false)
  })

  it('laisse passer une plage publique proche d’une plage privée', () => {
    // 172.32 est public : le filtre ne doit pas être trop large.
    expect(isPublicHttpUrl('http://172.32.0.1/')).toBe(true)
    expect(isPublicHttpUrl('http://11.0.0.1/')).toBe(true)
  })

  it('refuse les protocoles qui n’ont rien à faire ici', () => {
    expect(isPublicHttpUrl('file:///etc/passwd')).toBe(false)
    expect(isPublicHttpUrl('ftp://exemple.fr/')).toBe(false)
    expect(isPublicHttpUrl('data:text/html,<script>')).toBe(false)
  })

  it('refuse une adresse illisible plutôt que de tenter la requête', () => {
    expect(isPublicHttpUrl('pas une url')).toBe(false)
    expect(isPublicHttpUrl('')).toBe(false)
  })
})

describe('scrapeWebsiteReviews — note agrégée (JSON-LD)', () => {
  it('lit un aggregateRating schema.org à la racine', async () => {
    pageAvecHtml('<html><head><script type="application/ld+json">{"@type":"LocalBusiness","aggregateRating":{"@type":"AggregateRating","ratingValue":"4.9","reviewCount":"37"}}</script></head><body></body></html>')
    const r = await scrapeWebsiteReviews('https://exemple.fr')
    expect(r.aggregate).toEqual({ value: 4.9, count: 37 })
  })

  it('le trouve aussi dans un @graph imbriqué (courant chez les sites WordPress/Yoast)', async () => {
    pageAvecHtml('<html><head><script type="application/ld+json">{"@graph":[{"@type":"WebSite"},{"@type":"LocalBusiness","aggregateRating":{"ratingValue":4.6,"ratingCount":12}}]}</script></head></html>')
    const r = await scrapeWebsiteReviews('https://exemple.fr')
    expect(r.aggregate).toEqual({ value: 4.6, count: 12 })
  })

  it('aucune note si le site n’en publie aucune', async () => {
    pageAvecHtml('<html><body>Bonjour, pas d’avis structuré ici.</body></html>')
    const r = await scrapeWebsiteReviews('https://exemple.fr')
    expect(r.aggregate).toBeUndefined()
  })

  it('ignore un bloc JSON-LD illisible plutôt que de planter', async () => {
    pageAvecHtml('<html><head><script type="application/ld+json">{ ceci n’est pas du json }</script></head></html>')
    const r = await scrapeWebsiteReviews('https://exemple.fr')
    expect(r.aggregate).toBeUndefined()
  })

  it('ignore une note hors bornes (au-delà de 5)', async () => {
    pageAvecHtml('<html><head><script type="application/ld+json">{"aggregateRating":{"ratingValue":"7.2","reviewCount":"5"}}</script></head></html>')
    const r = await scrapeWebsiteReviews('https://exemple.fr')
    expect(r.aggregate).toBeUndefined()
  })
})

describe('fetchGooglePlaceRating', () => {
  it('renvoie la note et le nombre d’avis quand Google répond', async () => {
    fetchGoogleMaps.mockResolvedValue({ status: 'OK', result: { rating: 4.8, user_ratings_total: 52 } })
    expect(await fetchGooglePlaceRating('abc')).toEqual({ value: 4.8, count: 52 })
  })

  it('renvoie null si Google échoue (déjà tracé par fetchGoogleMaps)', async () => {
    fetchGoogleMaps.mockResolvedValue(null)
    expect(await fetchGooglePlaceRating('abc')).toBeNull()
  })

  it('renvoie null si la fiche n’a aucun avis', async () => {
    fetchGoogleMaps.mockResolvedValue({ status: 'OK', result: { rating: 0, user_ratings_total: 0 } })
    expect(await fetchGooglePlaceRating('abc')).toBeNull()
  })

  it('met l’appel en cache 24 h et encode l’identifiant dans l’URL', async () => {
    fetchGoogleMaps.mockResolvedValue({ status: 'OK', result: { rating: 5, user_ratings_total: 1 } })
    await fetchGooglePlaceRating('abc def')
    const [url, event, init] = fetchGoogleMaps.mock.calls[0]
    expect(String(url)).toContain('place_id=abc%20def')
    expect(event).toBe('places.rating')
    expect(init).toEqual({ next: { revalidate: 86400 } })
  })
})

describe('reviewsForWasher', () => {
  it('sans site ni fiche Google : aucun avis', async () => {
    const r = await reviewsForWasher({ website_url: null, google_place_id: null })
    expect(r).toEqual({ reviews: [] })
  })

  it('priorité à Google quand la fiche est renseignée', async () => {
    fetchGoogleMaps.mockResolvedValue({ status: 'OK', result: { rating: 4.9, user_ratings_total: 37 } })
    const r = await reviewsForWasher({ website_url: null, google_place_id: 'abc' })
    expect(r.aggregate).toEqual({ value: 4.9, count: 37 })
  })

  it('retombe sur le site si la fiche Google ne répond rien (ex. identifiant invalide)', async () => {
    fetchGoogleMaps.mockResolvedValue(null)
    pageAvecHtml('<html><head><script type="application/ld+json">{"aggregateRating":{"ratingValue":4.5,"reviewCount":9}}</script></head></html>')
    const r = await reviewsForWasher({ website_url: 'https://exemple.fr', google_place_id: 'invalide' })
    expect(r.aggregate).toEqual({ value: 4.5, count: 9 })
  })

  it('utilise le site quand aucune fiche Google n’est renseignée', async () => {
    pageAvecHtml('<html><head><script type="application/ld+json">{"aggregateRating":{"ratingValue":4.2,"reviewCount":3}}</script></head></html>')
    const r = await reviewsForWasher({ website_url: 'https://exemple.fr', google_place_id: null })
    expect(r.aggregate).toEqual({ value: 4.2, count: 3 })
  })
})

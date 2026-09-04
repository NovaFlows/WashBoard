import { describe, it, expect, vi, beforeEach } from 'vitest'

// Les avis Google alimentent la page de réservation, vue par les clients du
// laveur. Ce qui compte ici : ne jamais afficher une carte vide, et ne pas
// inventer de note globale.

const appelGoogle = vi.fn()

vi.mock('@/lib/googleMaps', () => ({
  fetchGoogleMaps: (...args: unknown[]) => appelGoogle(...args),
}))

const { fetchGooglePlaceReviews } = await import('./googleReviews')

beforeEach(() => appelGoogle.mockReset())

describe('fetchGooglePlaceReviews', () => {
  it('convertit les avis de Google dans le format de la page', async () => {
    appelGoogle.mockResolvedValue({
      result: {
        rating: 4.8,
        user_ratings_total: 253,
        reviews: [
          { author_name: 'Marc D.', rating: 5, text: 'Voiture impeccable.', relative_time_description: 'il y a une semaine' },
        ],
      },
    })

    const r = await fetchGooglePlaceReviews('place-123')
    expect(r.reviews).toEqual([
      { author: 'Marc D.', rating: 5, text: 'Voiture impeccable.', relativeTime: 'il y a une semaine' },
    ])
    expect(r.aggregate).toEqual({ value: 4.8, count: 253 })
  })

  it('écarte les avis sans texte', async () => {
    // Une note seule, sans commentaire, produirait une carte vide au milieu
    // du carrousel de la page de réservation.
    appelGoogle.mockResolvedValue({
      result: {
        reviews: [
          { author_name: 'A', rating: 5, text: 'Super travail.' },
          { author_name: 'B', rating: 4, text: '   ' },
          { author_name: 'C', rating: 5 },
        ],
      },
    })
    const r = await fetchGooglePlaceReviews('place-123')
    expect(r.reviews).toHaveLength(1)
    expect(r.reviews[0].author).toBe('A')
  })

  it('n’invente pas de note globale quand Google n’en donne pas', async () => {
    appelGoogle.mockResolvedValue({ result: { reviews: [{ author_name: 'A', rating: 5, text: 'Top.' }] } })
    const r = await fetchGooglePlaceReviews('place-123')
    expect(r.aggregate).toBeUndefined()
  })

  it('ignore une note globale portant sur zéro avis', async () => {
    // « 0 avis » afficherait « 0 avis » sous une note, ce qui n'a aucun sens.
    appelGoogle.mockResolvedValue({ result: { rating: 0, user_ratings_total: 0, reviews: [] } })
    const r = await fetchGooglePlaceReviews('place-123')
    expect(r.aggregate).toBeUndefined()
  })

  it('renvoie une liste vide sans appeler Google si l’identifiant est vide', async () => {
    const r = await fetchGooglePlaceReviews('   ')
    expect(r.reviews).toEqual([])
    expect(appelGoogle).not.toHaveBeenCalled()
  })

  it('survit à une panne de Google sans casser la page', async () => {
    // `fetchGoogleMaps` renvoie null sur erreur : la page de réservation doit
    // s'afficher sans avis plutôt que de tomber.
    appelGoogle.mockResolvedValue(null)
    const r = await fetchGooglePlaceReviews('place-123')
    expect(r.reviews).toEqual([])
    expect(r.aggregate).toBeUndefined()
  })

  it('remplace un auteur manquant plutôt que d’afficher un vide', async () => {
    appelGoogle.mockResolvedValue({ result: { reviews: [{ rating: 5, text: 'Rapide et soigné.' }] } })
    const r = await fetchGooglePlaceReviews('place-123')
    expect(r.reviews[0].author).toBe('Client')
  })

  it('demande les avis les plus récents, en français, et met en cache', async () => {
    appelGoogle.mockResolvedValue({ result: { reviews: [] } })
    await fetchGooglePlaceReviews('place-123')

    const [url, , revalidate] = appelGoogle.mock.calls[0] as [string, string, number]
    expect(url).toContain('reviews_sort=newest')
    expect(url).toContain('language=fr')
    // Le champ `reviews` est le plus cher de l'API Places : sans cache, une
    // page très visitée le ferait payer à chaque ouverture.
    expect(revalidate).toBe(86_400)
  })
})

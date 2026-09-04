import { fetchGoogleMaps } from '@/lib/googleMaps'

export type GoogleReview = {
  author: string
  rating: number
  text: string
  relativeTime: string
}

export type GoogleReviewResult = {
  reviews: GoogleReview[]
  aggregate?: { value: number; count: number }
}

export async function scrapeWebsiteReviews(websiteUrl: string): Promise<GoogleReviewResult> {
  try {
    const res = await fetch(websiteUrl, {
      next: { revalidate: 86400 },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
    })
    if (!res.ok) return { reviews: [] }

    const html = await res.text()

    // Supprimer scripts, styles, commentaires
    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(?:p|div|li|section|article|h[1-6]|blockquote)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&#x27;/g, "'")
      .replace(/\r\n/g, '\n')

    const lines = stripped.split('\n').map(l => l.trim()).filter(Boolean)

    const reviews: GoogleReview[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Compter les ★ dans la ligne — gérer les espaces entre ★ ★ ★ ★ ★
      const starCount = (line.match(/★/g) ?? []).length
      if (starCount < 1 || starCount > 5) continue

      // Chercher le texte de l'avis dans les lignes suivantes
      let reviewText = ''
      let author = ''

      for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
        const next = lines[j].replace(/★/g, '').trim()
        if (!next || next.length < 5) continue
        // Ignorer les lignes qui ressemblent à des notes chiffrées (ex: "4.9", "47 avis")
        if (/^\d+([.,]\d+)?(\s*\/\s*\d+)?(\s*(avis|reviews|étoiles?))?$/i.test(next)) continue
        if (!reviewText && next.length > 15) {
          reviewText = next
        } else if (reviewText && !author && next.length < 60 && !/^\d/.test(next)) {
          author = next
          break
        }
      }

      if (reviewText) {
        reviews.push({
          author: author || 'Client',
          rating: Math.min(5, Math.max(1, starCount)),
          text: reviewText,
          relativeTime: '',
        })
      }
    }

    // Dédupliquer
    const seen = new Set<string>()
    const unique = reviews.filter(r => {
      const key = r.text.slice(0, 30)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    return { reviews: unique.slice(0, 5) }
  } catch {
    return { reviews: [] }
  }
}

/** Avis publiés sur la fiche Google Business du laveur.
 *
 *  Préférable à la lecture de son site : la source est structurée, elle ne
 *  casse pas quand le site change de mise en page, et les avis y arrivent dès
 *  qu'un client les dépose.
 *
 *  ⚠️ Deux limites de Google, pas contournables :
 *  — l'API ne renvoie que **5 avis au maximum**, ceux qu'elle juge les plus
 *    pertinents. Impossible de tous les récupérer, ni de choisir lesquels.
 *  — le champ `reviews` est facturé plus cher que le reste de l'API Places.
 *    D'où le cache d'une journée côté Next : une page de réservation très
 *    visitée ne déclenche qu'un appel par jour et par laveur.
 */
export async function fetchGooglePlaceReviews(placeId: string): Promise<GoogleReviewResult> {
  if (!placeId.trim()) return { reviews: [] }

  type Reponse = {
    status?: string
    error_message?: string
    result?: {
      rating?: number
      user_ratings_total?: number
      reviews?: {
        author_name?: string
        rating?: number
        text?: string
        relative_time_description?: string
      }[]
    }
  }

  const url =
    'https://maps.googleapis.com/maps/api/place/details/json' +
    `?place_id=${encodeURIComponent(placeId.trim())}` +
    '&fields=rating,user_ratings_total,reviews' +
    '&reviews_sort=newest' +
    '&language=fr'

  // Une journée de cache : le champ `reviews` est le plus cher de l'API
  // Places, et une page de réservation très visitée la ferait payer à chaque
  // ouverture. Même durée que la lecture du site, pour un comportement
  // identique quelle que soit la source.
  const data = await fetchGoogleMaps<Reponse>(url, 'reviews.google_place', 86_400)
  if (!data?.result) return { reviews: [] }

  const reviews: GoogleReview[] = (data.result.reviews ?? [])
    // Un avis sans texte n'apporte rien à un visiteur : il afficherait une
    // carte vide au milieu du carrousel.
    .filter(r => (r.text ?? '').trim().length > 0)
    .map(r => ({
      author: (r.author_name ?? 'Client').trim(),
      rating: Number(r.rating ?? 0),
      text: (r.text ?? '').trim(),
      relativeTime: (r.relative_time_description ?? '').trim(),
    }))

  const note = data.result.rating
  const total = data.result.user_ratings_total
  return {
    reviews,
    aggregate: typeof note === 'number' && typeof total === 'number' && total > 0
      ? { value: note, count: total }
      : undefined,
  }
}

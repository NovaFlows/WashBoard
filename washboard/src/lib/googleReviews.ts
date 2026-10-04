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

/** L'adresse est-elle un site public, et non une ressource interne ?
 *
 *  Ce champ est rempli librement par le laveur et récupéré par NOTRE serveur.
 *  Sans ce contrôle, il pouvait y mettre `http://localhost:3000/api/...` ou une
 *  adresse du réseau interne de l'hébergeur et s'en servir pour sonder ce qui
 *  n'est pas accessible depuis l'extérieur. Signalé par un audit externe le
 *  2026-09-05.
 *
 *  Exportee pour être testable : c'est une frontière de sécurité, elle mérite
 *  d'être vérifiée cas par cas. */
export function isPublicHttpUrl(brut: string): boolean {
  let url: URL
  try {
    url = new URL(brut)
  } catch {
    return false
  }

  // `file:`, `ftp:`, `data:`... n'ont aucune raison d'être ici.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false

  const hote = url.hostname.toLowerCase()

  // Boucle locale et noms internes.
  if (hote === 'localhost' || hote.endsWith('.localhost') || hote.endsWith('.local')) return false
  if (hote === '::1' || hote === '[::1]') return false
  // Métadonnées des hébergeurs : la cible classique de ce type d'attaque.
  if (hote === 'metadata.google.internal' || hote === '169.254.169.254') return false

  // Plages privées IPv4 (RFC 1918), boucle locale et lien-local.
  const ipv4 = hote.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])]
    if (a === 10 || a === 127 || a === 0) return false
    if (a === 172 && b >= 16 && b <= 31) return false
    if (a === 192 && b === 168) return false
    if (a === 169 && b === 254) return false
  }

  return true
}

export async function scrapeWebsiteReviews(websiteUrl: string): Promise<GoogleReviewResult> {
  if (!isPublicHttpUrl(websiteUrl)) return { reviews: [] }

  try {
    // Délai maximal : une adresse qui ne répond jamais bloquait le rendu de la
    // page de réservation du laveur, donc ses propres clients.
    const res = await fetch(websiteUrl, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(5_000),
      // Une redirection peut mener vers une adresse interne : on ne la suit
      // pas, la vérification ci-dessus ne porterait alors sur rien.
      redirect: 'error',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
    })
    if (!res.ok) return { reviews: [] }

    const html = await res.text()

    // La moyenne (si le site en publie une) vit dans son balisage structuré,
    // AVANT qu'on retire les <script> ci-dessous pour lire le texte brut.
    const aggregate = extraireAggregateRatingJsonLd(html) ?? undefined

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

    return { reviews: unique.slice(0, 5), aggregate }
  } catch {
    return { reviews: [] }
  }
}

/** Cherche un `aggregateRating` (vocabulaire schema.org) dans les blocs
 *  JSON-LD de la page — la moyenne et le nombre d'avis tels que le site les
 *  publie lui-même (widget d'avis, thème avec données structurées...),
 *  plutôt qu'une estimation reconstituée à partir des quelques avis qu'on a
 *  pu repérer en scannant le texte. `null` si la page n'en expose aucun. */
function extraireAggregateRatingJsonLd(html: string): { value: number; count: number } | null {
  for (const bloc of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown
    try {
      data = JSON.parse(bloc[1])
    } catch {
      continue
    }
    const trouve = chercherAggregateRating(data)
    if (trouve) return trouve
  }
  return null
}

function chercherAggregateRating(noeud: unknown, profondeur = 0): { value: number; count: number } | null {
  // Les JSON-LD imbriquent rarement plus de quelques niveaux : cette limite
  // évite seulement une récursion infinie sur un document pathologique.
  if (profondeur > 6 || !noeud || typeof noeud !== 'object') return null

  if (Array.isArray(noeud)) {
    for (const item of noeud) {
      const trouve = chercherAggregateRating(item, profondeur + 1)
      if (trouve) return trouve
    }
    return null
  }

  const objet = noeud as Record<string, unknown>
  const agg = objet.aggregateRating
  if (agg && typeof agg === 'object') {
    const a = agg as Record<string, unknown>
    const value = Number(a.ratingValue)
    const count = Number(a.reviewCount ?? a.ratingCount)
    if (Number.isFinite(value) && value > 0 && value <= 5 && Number.isFinite(count) && count > 0) {
      return { value, count: Math.round(count) }
    }
  }

  for (const valeur of Object.values(objet)) {
    if (valeur && typeof valeur === 'object') {
      const trouve = chercherAggregateRating(valeur, profondeur + 1)
      if (trouve) return trouve
    }
  }
  return null
}

type DetailsPlaceReponse = {
  status?: string
  error_message?: string
  result?: { rating?: number; user_ratings_total?: number }
}

/** Note officielle d'un laveur sur Google, via l'API Places — seulement s'il a
 *  renseigné l'identifiant de sa fiche (`google_place_id`). Mise en cache 24 h
 *  comme `scrapeWebsiteReviews` : une note ne change pas d'une visite à
 *  l'autre, et chaque appel est facturé à Google.
 *
 *  `null` si l'identifiant est vide, si Google ne renvoie rien d'exploitable
 *  (fiche sans avis, identifiant invalide), ou en cas de panne — déjà tracée
 *  par `fetchGoogleMaps` (REQUEST_DENIED, clé absente...), même leçon que
 *  l'incident de facturation du 2026-08-26 sur les autres API Maps. */
export async function fetchGooglePlaceRating(placeId: string): Promise<{ value: number; count: number } | null> {
  const url =
    `https://maps.googleapis.com/maps/api/place/details/json` +
    `?place_id=${encodeURIComponent(placeId)}&fields=rating,user_ratings_total&language=fr`
  const data = await fetchGoogleMaps<DetailsPlaceReponse>(url, 'places.rating', { next: { revalidate: 86400 } })
  const { rating, user_ratings_total } = data?.result ?? {}
  if (typeof rating !== 'number' || typeof user_ratings_total !== 'number' || user_ratings_total <= 0) return null
  return { value: rating, count: Math.round(user_ratings_total) }
}

/** Avis à afficher sur la page de réservation d'un laveur : Google en
 *  priorité s'il a renseigné sa fiche (`google_place_id`) — la note
 *  officielle, à jour — sinon, ou si Google ne répond rien d'exploitable, on
 *  retombe sur ce que son propre site publie (`scrapeWebsiteReviews`). Pensé
 *  pour le laveur qui n'a qu'un site, sans fiche Google renseignée : il garde
 *  quand même une note affichée si son site en publie une.
 *
 *  Les extraits d'avis (citations) restent ceux du site dans tous les cas :
 *  l'API Places impose des règles d'affichage (attribution, tri, mise à jour)
 *  pour les siens, qu'on ne gère pas ici. */
export async function reviewsForWasher(washer: {
  website_url: string | null
  google_place_id?: string | null
}): Promise<GoogleReviewResult> {
  const site = washer.website_url ? await scrapeWebsiteReviews(washer.website_url) : { reviews: [] }

  const placeId = washer.google_place_id?.trim()
  if (placeId) {
    const google = await fetchGooglePlaceRating(placeId)
    if (google) return { reviews: site.reviews, aggregate: google }
  }

  return site
}

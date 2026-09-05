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

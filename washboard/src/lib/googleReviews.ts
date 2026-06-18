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

export type ScrapedReview = {
  author: string
  rating: number
  text: string
}

export type ScrapeResult = {
  reviews: ScrapedReview[]
  aggregate?: { value: number; count: number }
}

// ── JSON-LD schema.org extraction ──────────────────────────────────────────

function extractFromJsonLd(html: string): ScrapeResult {
  const reviews: ScrapedReview[] = []
  let aggregate: { value: number; count: number } | undefined

  const scriptRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null

  while ((m = scriptRe.exec(html)) !== null) {
    try {
      const raw = JSON.parse(m[1])
      const items: unknown[] = Array.isArray(raw) ? raw : [raw]

      for (const item of items) {
        if (typeof item !== 'object' || item === null) continue
        const obj = item as Record<string, unknown>
        const nodes: unknown[] = Array.isArray(obj['@graph']) ? (obj['@graph'] as unknown[]) : [obj]

        for (const n of nodes) {
          if (typeof n !== 'object' || n === null) continue
          const node = n as Record<string, unknown>

          const agg = node.aggregateRating as Record<string, unknown> | undefined
          if (agg && !aggregate) {
            const v = parseFloat(String(agg.ratingValue ?? ''))
            const c = parseInt(String(agg.reviewCount ?? agg.ratingCount ?? '0'), 10)
            if (v >= 1 && v <= 5) aggregate = { value: v, count: c }
          }

          const list: unknown[] = Array.isArray(node.review)
            ? (node.review as unknown[])
            : node['@type'] === 'Review'
            ? [node]
            : []

          for (const r of list) {
            if (typeof r !== 'object' || r === null) continue
            const rv = r as Record<string, unknown>
            const ratingRaw = (rv.reviewRating as Record<string, unknown>)?.ratingValue ?? rv.ratingValue
            const rating = parseFloat(String(ratingRaw ?? '0'))
            const authorRaw = rv.author
            const author =
              typeof authorRaw === 'string'
                ? authorRaw
                : typeof authorRaw === 'object' && authorRaw !== null
                ? String((authorRaw as Record<string, unknown>).name ?? 'Anonyme')
                : 'Anonyme'
            const text = String(rv.reviewBody ?? rv.description ?? '').trim()
            if (text && rating >= 1 && rating <= 5) {
              reviews.push({ author, rating: Math.round(rating), text })
            }
          }
        }
      }
    } catch {}
  }

  return { reviews, aggregate }
}

// ── HTML plain-text heuristic extraction ──────────────────────────────────
// Works for sites that show ★ stars + « quoted text » + Author Name
// without any schema.org markup (e.g. Wix / custom sites).

function extractFromPlainText(html: string): ScrapedReview[] {
  // Decode common HTML entities so «/» and smart quotes survive tag stripping
  const decoded = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/&laquo;/gi, '«')
    .replace(/&raquo;/gi, '»')
    .replace(/&ldquo;/gi, '“')
    .replace(/&rdquo;/gi, '”')
    .replace(/&quot;/gi, '"')
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&#171;/g, '«')
    .replace(/&#187;/g, '»')
    .replace(/&amp;/gi, '&')
    .replace(/&[^;]{1,10};/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')

  const reviews: ScrapedReview[] = []

  // Match quoted blocks: «...» or "..."
  const quoteRe = /[«“"]([^»”"]{20,500})[»”"]/g
  let m: RegExpExecArray | null

  while ((m = quoteRe.exec(decoded)) !== null) {
    const reviewText = m[1].trim()

    // Stars within 300 chars before the quote
    // Handle both consecutive ★★★★★ and spaced ★ ★ ★ ★ ★ (individual spans)
    const before = decoded.slice(Math.max(0, m.index - 300), m.index)
    const starsMatch = before.match(/(★\s*)+$/)
    const rating = starsMatch
      ? Math.min(5, (starsMatch[0].match(/★/g) ?? []).length)
      : 5

    // Author within 200 chars after the quote
    // Looks for: FirstName (≥3 chars) + space + LastName/Initial (≥1 char + optional dot)
    // Skips single-letter tokens (avatar initials like "M")
    const after = decoded.slice(m.index + m[0].length, m.index + m[0].length + 200)
    const authorMatch = after.match(/\b([A-ZÀ-Ÿ][a-zà-ÿ]{2,20}\.?\s+[A-ZÀ-Ÿ][a-zà-ÿ]{0,20}\.?)/)
    const author = authorMatch ? authorMatch[1].trim() : 'Client'

    reviews.push({ author, rating, text: reviewText })
  }

  return reviews
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function scrapeReviews(websiteUrl: string): Promise<ScrapeResult> {
  try {
    const url = websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`

    const res = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WashBoard/1.0)' },
      next: { revalidate: 3600 },
    })

    if (!res.ok) return { reviews: [] }

    const html = await res.text()

    // 1. Try schema.org JSON-LD first
    const ldResult = extractFromJsonLd(html)
    if (ldResult.reviews.length > 0 || ldResult.aggregate) {
      return { reviews: ldResult.reviews.slice(0, 6), aggregate: ldResult.aggregate }
    }

    // 2. Fallback: plain-text pattern matching
    const textReviews = extractFromPlainText(html)
    return { reviews: textReviews.slice(0, 6) }
  } catch {
    return { reviews: [] }
  }
}

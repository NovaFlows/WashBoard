// Rate-limit en mémoire (fenêtre glissante simple).
//
// ⚠️ Limite : la mémoire n'est PAS partagée entre instances serverless, donc
// c'est un garde-fou « best-effort » par instance, pas une protection absolue.
// Pour un blocage strict multi-instances, prévoir Upstash/Redis ou une table.
// Combiné au honeypot et au plafond par laveur/jour, ça couvre l'essentiel.

type Hit = { count: number; reset: number }
const store = new Map<string, Hit>()

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now()
  const hit = store.get(key)

  if (!hit || now > hit.reset) {
    store.set(key, { count: 1, reset: now + windowMs })
    return { ok: true, retryAfter: 0 }
  }

  hit.count += 1
  if (hit.count > limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((hit.reset - now) / 1000)) }
  }
  return { ok: true, retryAfter: 0 }
}

// Nettoyage opportuniste pour éviter une croissance illimitée de la Map.
export function cleanupRateLimit() {
  const now = Date.now()
  if (store.size < 1000) return
  for (const [k, v] of store) if (now > v.reset) store.delete(k)
}

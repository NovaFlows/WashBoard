import { describe, it, expect, vi, beforeEach } from 'vitest'

// Aperçu que le laveur consulte après avoir réglé son site/sa fiche Google,
// pour voir tout de suite ce qui sera réellement affiché — sans avoir à aller
// vérifier sa page publique lui-même (voir l'en-tête de route.ts).

type Plan = { washer: Record<string, unknown> | null; washerError: unknown }
let plan: Plan

const fauxSupabase = {
  from: () => {
    const b: Record<string, unknown> = {}
    const self = () => b
    Object.assign(b, {
      select: self, eq: self,
      single: () => Promise.resolve({ data: plan.washer, error: plan.washerError }),
    })
    return b
  },
}

vi.mock('@/lib/requireWasher', () => ({
  requireWasher: async () => ({ ok: true, ctx: { supabase: fauxSupabase, washerId: 'washer-1' } }),
}))

const reviewsForWasher = vi.fn()
vi.mock('@/lib/googleReviews', () => ({ reviewsForWasher: (...args: unknown[]) => reviewsForWasher(...args) }))

const { GET } = await import('./route')

beforeEach(() => {
  plan = { washer: { website_url: null, google_place_id: null }, washerError: null }
  reviewsForWasher.mockReset()
})

describe('GET /api/washer/avis-preview', () => {
  it('ne fait aucun appel Google si rien n’est renseigné', async () => {
    const res = await GET()
    const body = await res.json()
    expect(body).toEqual({ aSource: false, aggregate: null })
    expect(reviewsForWasher).not.toHaveBeenCalled()
  })

  it('renvoie la note résolue quand le site ou la fiche en donne une', async () => {
    plan.washer = { website_url: null, google_place_id: 'ChIJ3ZJDzvYZ2EURMjh3k2Dj7jQ' }
    reviewsForWasher.mockResolvedValue({ reviews: [], aggregate: { value: 4.9, count: 37 } })
    const res = await GET()
    const body = await res.json()
    expect(body).toEqual({ aSource: true, aggregate: { value: 4.9, count: 37 } })
  })

  it('aSource vrai mais aggregate null : un réglage existe mais ne résout rien (le cas qui a piégé AutoNett)', async () => {
    plan.washer = { website_url: null, google_place_id: 'un-identifiant-invalide' }
    reviewsForWasher.mockResolvedValue({ reviews: [] })
    const res = await GET()
    const body = await res.json()
    expect(body).toEqual({ aSource: true, aggregate: null })
  })

  it('refuse si le profil est introuvable', async () => {
    plan = { washer: null, washerError: { code: 'PGRST116' } }
    const res = await GET()
    expect(res.status).toBe(404)
    expect(reviewsForWasher).not.toHaveBeenCalled()
  })
})

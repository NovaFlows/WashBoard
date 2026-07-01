import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { pickTravelFee, computeTravelFee } from './travelFee'
import type { SupabaseClient } from '@supabase/supabase-js'

const tiers = [
  { max_minutes: 15, fee: 5 },
  { max_minutes: 30, fee: 10 },
  { max_minutes: 60, fee: 20 },
]

describe('pickTravelFee', () => {
  it('renvoie 0 sans palier', () => {
    expect(pickTravelFee([], 20)).toBe(0)
  })

  it('prend le 1er palier qui couvre la durée', () => {
    expect(pickTravelFee(tiers, 10)).toBe(5)   // <= 15
    expect(pickTravelFee(tiers, 20)).toBe(10)  // <= 30
    expect(pickTravelFee(tiers, 45)).toBe(20)  // <= 60
  })

  it('inclut la borne (durée == max_minutes)', () => {
    expect(pickTravelFee(tiers, 15)).toBe(5)
    expect(pickTravelFee(tiers, 30)).toBe(10)
  })

  it('au-delà du dernier palier, applique le frais le plus élevé', () => {
    expect(pickTravelFee(tiers, 120)).toBe(20)
  })

  it('trie les paliers même fournis dans le désordre', () => {
    const messy = [
      { max_minutes: 60, fee: 20 },
      { max_minutes: 15, fee: 5 },
      { max_minutes: 30, fee: 10 },
    ]
    expect(pickTravelFee(messy, 10)).toBe(5)
    expect(pickTravelFee(messy, 200)).toBe(20)
  })
})

// Faux client Supabase minimal : chaque appel de builder renvoie le builder,
// les terminaux (single / limit) résolvent la donnée configurée selon la table.
function fakeSupabase(opts: {
  washer?: Record<string, unknown> | null
  prevBookings?: unknown[]
}): SupabaseClient {
  return {
    from(table: string) {
      const builder: Record<string, unknown> = {}
      const chain = () => builder
      builder.select = chain
      builder.eq = chain
      builder.in = chain
      builder.gte = chain
      builder.lt = chain
      builder.order = chain
      builder.single = () => Promise.resolve({ data: opts.washer ?? null })
      builder.limit = () => Promise.resolve({ data: table === 'bookings' ? (opts.prevBookings ?? []) : [] })
      return builder
    },
  } as unknown as SupabaseClient
}

describe('computeTravelFee', () => {
  const tiers = [{ max_minutes: 15, fee: 5 }, { max_minutes: 30, fee: 10 }, { max_minutes: 60, fee: 20 }]

  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', 'test-key')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('0 si le laveur n’a pas de paliers', async () => {
    const sb = fakeSupabase({ washer: { travel_fee_tiers: [], base_address: '1 rue A', travel_fee_mode: 'base' } })
    const fee = await computeTravelFee(sb, 'w1', 'dest', '2026-07-01T10:00:00Z')
    expect(fee).toBe(0)
  })

  it('0 si pas d’adresse de base', async () => {
    const sb = fakeSupabase({ washer: { travel_fee_tiers: tiers, base_address: null, travel_fee_mode: 'base' } })
    const fee = await computeTravelFee(sb, 'w1', 'dest', '2026-07-01T10:00:00Z')
    expect(fee).toBe(0)
  })

  it('mode base : applique le palier selon la durée Google Maps', async () => {
    const sb = fakeSupabase({ washer: { travel_fee_tiers: tiers, base_address: '1 rue A', travel_fee_mode: 'base' } })
    // 20 min → palier <= 30 → 10
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ rows: [{ elements: [{ duration: { value: 20 * 60 } }] }] }),
    }))
    const fee = await computeTravelFee(sb, 'w1', 'dest', '2026-07-01T10:00:00Z')
    expect(fee).toBe(10)
  })

  it('mode previous : part de l’adresse du RDV précédent', async () => {
    const sb = fakeSupabase({
      washer: { travel_fee_tiers: tiers, base_address: '1 rue A', travel_fee_mode: 'previous' },
      prevBookings: [{ address: '9 rue Z', scheduled_at: '2026-07-01T08:00:00Z' }],
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ rows: [{ elements: [{ duration: { value: 10 * 60 } }] }] }), // 10 min → 5
    }))
    const fee = await computeTravelFee(sb, 'w1', 'dest', '2026-07-01T10:00:00Z')
    expect(fee).toBe(5)
  })

  it('mode previous sans RDV précédent : retombe sur l’adresse de base', async () => {
    const sb = fakeSupabase({
      washer: { travel_fee_tiers: tiers, base_address: '1 rue A', travel_fee_mode: 'previous' },
      prevBookings: [], // aucun RDV avant → fallback base_address
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ rows: [{ elements: [{ duration: { value: 50 * 60 } }] }] }), // 50 min → 20
    }))
    const fee = await computeTravelFee(sb, 'w1', 'dest', '2026-07-01T10:00:00Z')
    expect(fee).toBe(20)
  })

  it('0 si la réponse Google Maps est inexploitable', async () => {
    const sb = fakeSupabase({ washer: { travel_fee_tiers: tiers, base_address: '1 rue A', travel_fee_mode: 'base' } })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ rows: [] }) }))
    const fee = await computeTravelFee(sb, 'w1', 'dest', '2026-07-01T10:00:00Z')
    expect(fee).toBe(0)
  })

  it('0 si fetch échoue (réseau)', async () => {
    const sb = fakeSupabase({ washer: { travel_fee_tiers: tiers, base_address: '1 rue A', travel_fee_mode: 'base' } })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    const fee = await computeTravelFee(sb, 'w1', 'dest', '2026-07-01T10:00:00Z')
    expect(fee).toBe(0)
  })
})

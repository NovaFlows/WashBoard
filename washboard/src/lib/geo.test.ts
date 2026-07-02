import { describe, it, expect } from 'vitest'
import { haversineKm } from './geo'

describe('haversineKm', () => {
  it('retourne 0 pour deux points identiques', () => {
    expect(haversineKm(48.8566, 2.3522, 48.8566, 2.3522)).toBeCloseTo(0)
  })
  it('calcule la distance Paris → Lyon (~392 km)', () => {
    const dist = haversineKm(48.8566, 2.3522, 45.7640, 4.8357)
    expect(dist).toBeGreaterThan(380)
    expect(dist).toBeLessThan(400)
  })
  it('est symétrique', () => {
    const ab = haversineKm(48.8566, 2.3522, 43.2965, 5.3698)
    const ba = haversineKm(43.2965, 5.3698, 48.8566, 2.3522)
    expect(ab).toBeCloseTo(ba, 5)
  })
})

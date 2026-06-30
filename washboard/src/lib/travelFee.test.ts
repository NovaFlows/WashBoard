import { describe, it, expect } from 'vitest'
import { pickTravelFee } from './travelFee'

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

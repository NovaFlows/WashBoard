import { describe, it, expect } from 'vitest'
import { VEHICLE_LABELS } from './vehicle-labels'

describe('VEHICLE_LABELS', () => {
  it('contient les 12 types canoniques', () => {
    expect(Object.keys(VEHICLE_LABELS)).toHaveLength(12)
  })
  it('expose les libellés attendus', () => {
    expect(VEHICLE_LABELS['SUV']).toBe('SUV / 4x4')
    expect(VEHICLE_LABELS['citadine_2p']).toBe('Citadine 2p')
    expect(VEHICLE_LABELS['velo']).toBe('Vélo / Trottinette')
  })
})

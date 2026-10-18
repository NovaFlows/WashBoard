import { describe, it, expect } from 'vitest'
import { SILHOUETTES, silhouettePour } from './silhouettesVehicules'
import { VEHICLE_LABELS } from './vehicle-labels'

describe('silhouettes des véhicules', () => {
  it('chaque type de véhicule de l’app a sa silhouette', () => {
    for (const type of Object.keys(VEHICLE_LABELS)) expect(silhouettePour(type), type).not.toBeNull()
  })
  it('un type personnalisé par le laveur n’en a pas', () => {
    expect(silhouettePour('3f2a9c0e-1b2c-4d5e-8f90-123456789abc')).toBeNull()
    expect(silhouettePour(null)).toBeNull()
    expect(silhouettePour('toString')).toBeNull()
  })
  it('chaque silhouette tient dans son cadre et pose ses roues au sol', () => {
    for (const [type, s] of Object.entries(SILHOUETTES)) {
      expect(s.corps.length, type).toBeGreaterThan(0)
      for (const r of s.roues) expect(Math.abs(r.cy + r.r - 380), type).toBeLessThanOrEqual(1)
    }
  })
})

import { describe, it, expect } from 'vitest'
import {
  vehiclePrice, hasPriceOverrides, minVehiclePrice, effectiveDuration,
  smartDiscountAmount, smartPrice, finalDisplayPrice,
} from './pricing'

const svc = { price: 100, vehicle_price_overrides: { SUV: 130, citadine: 80 }, vehicle_types: ['SUV', 'citadine', 'berline'] }

describe('vehiclePrice', () => {
  it('utilise la surcharge si définie', () => {
    expect(vehiclePrice(svc, 'SUV')).toBe(130)
    expect(vehiclePrice(svc, 'citadine')).toBe(80)
  })
  it('retombe sur le prix de base sinon', () => {
    expect(vehiclePrice(svc, 'inconnu')).toBe(100)
    expect(vehiclePrice({ price: 50 }, 'SUV')).toBe(50)
  })
})

describe('hasPriceOverrides / minVehiclePrice', () => {
  it('détecte les surcharges réelles', () => {
    expect(hasPriceOverrides(svc)).toBe(true)
    expect(hasPriceOverrides({ price: 50 })).toBe(false)
    expect(hasPriceOverrides({ price: 50, vehicle_price_overrides: { SUV: 50 } })).toBe(false) // identique au base
  })
  it('renvoie le prix minimum', () => {
    expect(minVehiclePrice(svc)).toBe(80)
    expect(minVehiclePrice({ price: 50 })).toBe(50)
  })
})

// Régression bug prod : un type désélectionné laisse une surcharge "orpheline"
// (ex. monospace: 30) qui ne doit PAS tirer le « à partir de » vers le bas.
describe('surcharge orpheline (type non proposé) — bug prod', () => {
  const withOrphan = {
    price: 120,
    vehicle_types: ['citadine', 'berline', 'SUV'],
    vehicle_price_overrides: { berline: 140, SUV: 160, monospace: 30 },
  }
  it('ignore la surcharge du type non proposé pour le minimum', () => {
    expect(minVehiclePrice(withOrphan)).toBe(120) // pas 30
  })
  it('détecte quand même les vraies surcharges des types proposés', () => {
    expect(hasPriceOverrides(withOrphan)).toBe(true) // berline 140 ≠ 120
  })
  it('vehiclePrice d’un type proposé reste correct', () => {
    expect(vehiclePrice(withOrphan, 'citadine')).toBe(120) // base (pas de surcharge)
    expect(vehiclePrice(withOrphan, 'SUV')).toBe(160)
  })
})

describe('effectiveDuration', () => {
  it('multiplie la durée par le nombre de véhicules (min 1)', () => {
    expect(effectiveDuration(60, 2)).toBe(120)
    expect(effectiveDuration(45, 1)).toBe(45)
    expect(effectiveDuration(60, null)).toBe(60)
    expect(effectiveDuration(60, 0)).toBe(60)
  })
})

describe('remise « créneau optimisé »', () => {
  it('montant fixe', () => {
    expect(smartDiscountAmount(100, { type: 'fixed', value: 15 })).toBe(15)
    expect(smartPrice(100, { type: 'fixed', value: 15 })).toBe(85)
  })
  it('montant en pourcentage', () => {
    expect(smartDiscountAmount(100, { type: 'percent', value: 10 })).toBe(10)
    expect(smartPrice(200, { type: 'percent', value: 25 })).toBe(150)
  })
  it('ne descend jamais en dessous de 0', () => {
    expect(smartPrice(20, { type: 'fixed', value: 50 })).toBe(0)
  })
})

describe('finalDisplayPrice', () => {
  it('applique la remise seulement si créneau optimisé', () => {
    expect(finalDisplayPrice(100, true, 15)).toBe(85)
    expect(finalDisplayPrice(100, false, 15)).toBe(100)
    expect(finalDisplayPrice(10, true, 50)).toBe(0)
  })
})

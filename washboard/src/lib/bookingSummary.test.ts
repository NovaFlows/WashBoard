import { describe, it, expect } from 'vitest'
import { resumePrestation, resumeCreneau, montantMinimal, montantEstime } from './bookingSummary'
import type { Service } from '@/types'

const SERVICE: Service = {
  id: 's1', washer_id: 'w1', category_id: null, name: 'Complet',
  description: null, price: 75, duration_minutes: 120,
  vehicle_types: ['citadine', 'suv'], vehicle_price_overrides: { suv: 95 },
  addons: [],
}
const SERVICES = [SERVICE]

describe('resumePrestation', () => {
  it('rend une chaîne vide sans prestation choisie', () => {
    expect(resumePrestation({}, SERVICES)).toBe('')
  })

  it('combine le nom de la prestation, les véhicules et les options', () => {
    const resume = resumePrestation({
      service_id: 's1',
      vehicles_detail: [
        { type: 'suv', count: 1, unit_price: 95, label: 'SUV' },
        { type: 'suv', count: 1, unit_price: 95, label: 'SUV' },
      ],
      selected_addons: [{ id: 'a1', label: 'Lustrage', price: 25, category: 'extra' }],
    }, SERVICES)
    expect(resume).toBe('Complet, 2 SUV, lustrage')
  })

  it('déduplique une option cochée sur plusieurs véhicules', () => {
    const resume = resumePrestation({
      service_id: 's1',
      vehicles_detail: [{ type: 'suv', count: 1, unit_price: 95, label: 'SUV' }],
      selected_addons: [
        { id: 'a1', label: 'Shampoing', price: 30, category: 'extra' },
        { id: 'a2', label: 'Shampoing', price: 30, category: 'extra' },
      ],
    }, SERVICES)
    expect(resume).toBe('Complet, 1 SUV, shampoing')
  })
})

describe('resumeCreneau', () => {
  it('rend une chaîne vide sans créneau choisi', () => {
    expect(resumeCreneau({})).toBe('')
  })

  it('combine le jour, l’heure et l’adresse', () => {
    const resume = resumeCreneau({
      scheduled_at: '2026-10-08T12:00:00.000Z', // 14h00 à Paris (UTC+2 en octobre)
      address: '12 rue Mercière, 69002 Lyon',
    })
    expect(resume).toContain('14:00')
    expect(resume).toContain('12 rue Mercière, 69002 Lyon')
  })
})

describe('montantMinimal', () => {
  it('rend null pour un catalogue vide', () => {
    expect(montantMinimal([])).toBeNull()
  })

  it('rend le prix le plus bas, surcharges de véhicule comprises', () => {
    // citadine = 75 (pas de surcharge), suv = 95 → le plus bas est 75
    expect(montantMinimal(SERVICES)).toBe(75)
  })
})

describe('montantEstime', () => {
  it('rend 0 sans aucune donnée', () => {
    expect(montantEstime({})).toBe(0)
  })

  it('ajoute les frais de déplacement au prix de base', () => {
    expect(montantEstime({ booked_price: 95, travel_fee: 8 })).toBe(103)
  })

  it('applique la remise créneau optimisé uniquement si is_smart_slot est vrai', () => {
    expect(montantEstime({ booked_price: 95, travel_fee: 8, smart_discount: 10, is_smart_slot: true })).toBe(93)
    expect(montantEstime({ booked_price: 95, travel_fee: 8, smart_discount: 10, is_smart_slot: false })).toBe(103)
  })
})

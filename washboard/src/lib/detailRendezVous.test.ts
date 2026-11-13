import { describe, expect, it } from 'vitest'
import { detailUtile, lignesDetailPrix, nomsPrestations } from './detailRendezVous'

const addon = (id: string, label: string, price: number) => ({ id, label, price, category: id.startsWith('prestation:') ? 'prestation' : 'x' })
const sable = addon('sable', 'Sable', 15)
const complet = addon('prestation:p2', 'Lavage complet', 65)

describe('détail d’un rendez-vous', () => {
  const b = {
    services: { name: 'Lavage extérieur' },
    vehicles_detail: [{ type: 'citadine', count: 1, unit_price: 40, addons: [complet, sable] }],
    selected_addons: [complet, sable],
    travel_fee: 15,
  }

  it('nomme toutes les prestations, la principale d’abord', () => {
    expect(nomsPrestations(b)).toEqual(['Lavage extérieur', 'Lavage complet'])
    expect(nomsPrestations({ services: { name: 'Seule' }, vehicles_detail: null })).toEqual(['Seule'])
    expect(nomsPrestations({})).toEqual([])
  })

  it('détaille la prestation, la prestation ajoutée, l’option puis le déplacement', () => {
    expect(lignesDetailPrix(b).map(l => [l.libelle, l.montant, l.genre])).toEqual([
      ['Lavage extérieur', 40, 'principale'],
      ['Lavage complet', 65, 'prestation'],
      ['Sable', 15, 'option'],
      ['Frais de déplacement', 15, 'deplacement'],
    ])
  })

  it('regroupe une même ligne portée par deux véhicules', () => {
    const deux = { ...b, vehicles_detail: [
      { type: 'citadine', count: 1, unit_price: 40, addons: [complet] },
      { type: 'citadine', count: 1, unit_price: 40, addons: [complet] },
    ], travel_fee: 0 }
    expect(lignesDetailPrix(deux).map(l => [l.libelle, l.montant])).toEqual([['Lavage extérieur × 2', 80], ['Lavage complet × 2', 130]])
  })

  it('ancien format (options communes, sans véhicules détaillés) : options et déplacement seulement', () => {
    const ancien = { services: { name: 'Complet' }, vehicles_detail: null, selected_addons: [sable], travel_fee: 10 }
    expect(lignesDetailPrix(ancien).map(l => l.libelle)).toEqual(['Sable', 'Frais de déplacement'])
  })

  it('rien à détailler pour une prestation seule', () => {
    const seule = { services: { name: 'Complet' }, vehicles_detail: [{ type: 'citadine', count: 1, unit_price: 60 }], selected_addons: [], travel_fee: 0 }
    expect(detailUtile(lignesDetailPrix(seule))).toBe(false)
    expect(detailUtile(lignesDetailPrix(b))).toBe(true)
  })
})

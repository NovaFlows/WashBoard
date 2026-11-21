import { describe, expect, it } from 'vitest'
import { detailUtile, libellePrestations, lignesDetailPrix, nomsPrestations } from './detailRendezVous'

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

  it('libellé sur une ligne pour les emails, le reçu et l’historique', () => {
    expect(libellePrestations(b)).toBe('Lavage extérieur + Lavage complet')
    expect(libellePrestations({ services: { name: 'Seule' } })).toBe('Seule')
    expect(libellePrestations({})).toBe('Lavage')
    expect(libellePrestations({}, 'Prestation')).toBe('Prestation')
    // Ancien format, options communes : la prestation ajoutée est nommée aussi.
    expect(libellePrestations({ services: { name: 'Lavage extérieur' }, vehicles_detail: [{ type: 'citadine', count: 1, unit_price: 40 }], selected_addons: [complet] }))
      .toBe('Lavage extérieur + Lavage complet')
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

  it('même prestation à des prix différents selon le véhicule : la somme réelle, pas un seul prix', () => {
    const mixte = { ...b, vehicles_detail: [
      { type: 'citadine', count: 2, unit_price: 40, addons: [complet] },
      { type: 'suv', count: 1, unit_price: 50, addons: [{ ...complet, price: 80 }] },
    ], travel_fee: 0 }
    expect(lignesDetailPrix(mixte).map(l => [l.libelle, l.montant])).toEqual([['Lavage extérieur × 3', 130], ['Lavage complet × 3', 65 * 2 + 80]])
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

  it('réservation réelle enregistrée par le site : Lavage extérieur + Lavage complet, Sable, déplacement', () => {
    const reelle = {
      services: { name: 'Lavage extérieur' },
      vehicles_detail: [{ type: 'citadine_2p', count: 1, unit_price: 40, label: 'Citadine 2p', models: ['208'], addons: [
        { id: '24b4bcc2-878b-42fb-b153-5329692173e7', label: 'Sable', price: 15, category: 'Suppléments intérieur' },
        { id: 'prestation:c033fac6-4dc3-4c7d-8cae-fd8876468bf3', label: 'Lavage complet', price: 65, category: 'prestation', duration_minutes: 90 },
      ] }],
      selected_addons: [
        { id: '24b4bcc2-878b-42fb-b153-5329692173e7', label: 'Sable', price: 15, category: 'Suppléments intérieur' },
        { id: 'prestation:c033fac6-4dc3-4c7d-8cae-fd8876468bf3', label: 'Lavage complet', price: 65, category: 'prestation', duration_minutes: 90 },
      ],
      travel_fee: 15,
    }
    expect(nomsPrestations(reelle).join(' + ')).toBe('Lavage extérieur + Lavage complet')
    expect(lignesDetailPrix(reelle).map(l => [l.libelle, l.montant])).toEqual([
      ['Lavage extérieur', 40], ['Lavage complet', 65], ['Sable', 15], ['Frais de déplacement', 15],
    ])
  })
})

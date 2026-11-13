import { describe, expect, it } from 'vitest'
import type { ServiceAddon } from '@/types'
import {
  limitesCombinees, prestationsCompatibles,
  appliquerPrestations, basculerPrestation, estPrestationSupplementaire, idPrestationSupplementaire,
  idsPrestationsSupplementaires, MAX_PRESTATIONS, optionDepuisPrestation, optionsDeLaPrestation,
  normaliserPrestationsSupplementaires, prestationsChoisies, typesCommuns, type PrestationCatalogue,
} from './plusieursPrestations'

const service = (id: string, extra: Record<string, unknown> = {}) => ({
  id, name: `Presta ${id}`, price: 50, duration_minutes: 60, vehicle_price_overrides: {}, addons: [], vehicle_types: ['citadine', 'SUV'], ...extra,
})

describe('plusieursPrestations', () => {
  it('reconnaît une prestation supplémentaire à son préfixe', () => {
    expect(estPrestationSupplementaire({ id: 'prestation:abc' })).toBe(true)
    expect(estPrestationSupplementaire({ id: 'prestation:' })).toBe(false)
    expect(estPrestationSupplementaire({ id: 'cire' })).toBe(false)
    expect(estPrestationSupplementaire({})).toBe(false)
    expect(idPrestationSupplementaire({ id: 'prestation:abc' })).toBe('abc')
    expect(idPrestationSupplementaire({ id: 'cire' })).toBeNull()
  })

  it('transforme une prestation en option, au prix du type du véhicule', () => {
    const s = service('a', { vehicle_price_overrides: { SUV: 80 } })
    expect(optionDepuisPrestation(s, 'citadine')).toEqual({ id: 'prestation:a', label: 'Presta a', price: 50, category: 'prestation', duration_minutes: 60 })
    expect(optionDepuisPrestation(s, 'SUV').price).toBe(80)
  })

  it('sépare les options de la prestation des prestations supplémentaires', () => {
    const options = [{ id: 'cire' }, { id: 'prestation:b' }, { id: 'prestation:b' }, { id: 'prestation:c' }]
    expect(optionsDeLaPrestation(options)).toEqual([{ id: 'cire' }])
    expect(idsPrestationsSupplementaires(options)).toEqual(['b', 'c'])
    expect(optionsDeLaPrestation(null)).toEqual([])
    expect(idsPrestationsSupplementaires(undefined)).toEqual([])
  })

  it('liste les prestations cochées, la principale d’abord', () => {
    expect(prestationsChoisies('a', [{ addons: [{ id: 'prestation:b' }] }, { addons: [{ id: 'prestation:b' }] }])).toEqual(['a', 'b'])
    expect(prestationsChoisies('', [])).toEqual([])
    expect(prestationsChoisies('a', undefined)).toEqual(['a'])
  })

  it('ne garde que les types proposés par toutes les prestations', () => {
    expect(typesCommuns([service('a'), service('b', { vehicle_types: ['SUV', 'moto'] })])).toEqual(['SUV'])
    expect(typesCommuns([])).toEqual([])
  })

  it('coche, décoche, et passe la suivante en tête quand on retire la principale', () => {
    expect(basculerPrestation([], 'a')).toEqual(['a'])
    expect(basculerPrestation(['a'], 'b')).toEqual(['a', 'b'])
    expect(basculerPrestation(['a', 'b'], 'a')).toEqual(['b'])
    expect(basculerPrestation(['a', 'b'], 'b')).toEqual(['a'])
  })

  it(`refuse d’aller au-delà de ${MAX_PRESTATIONS} prestations`, () => {
    const pleine = Array.from({ length: MAX_PRESTATIONS }, (_, i) => `p${i}`)
    expect(basculerPrestation(pleine, 'autre')).toEqual(pleine)
  })

  it('écrit la principale en prestation et les autres en options de chaque véhicule', () => {
    const a = service('a', { addons: [{ id: 'cire', label: 'Cire', price: 10, category: 'x' }] })
    const b = service('b', { vehicle_price_overrides: { SUV: 90 } })
    const r = appliquerPrestations([a, b], [{ type: 'citadine' }, { type: 'SUV' }] as { type: string; addons?: ServiceAddon[] }[])
    expect(r.service_id).toBe('a')
    expect(r.vehicules[0].addons?.map(x => [x.id, x.price])).toEqual([['prestation:b', 50]])
    expect(r.vehicules[1].addons?.map(x => [x.id, x.price])).toEqual([['prestation:b', 90]])
  })

  it('garde les options de la principale quand elle n’a pas changé, pas sinon', () => {
    const cire = { id: 'cire', label: 'Cire', price: 10, category: 'x' }
    const a = service('a', { addons: [cire] })
    const b = service('b')
    const v = [{ type: 'citadine', addons: [cire] }]
    expect(appliquerPrestations([a, b], v, 'a').vehicules[0].addons?.map(x => x.id)).toEqual(['cire', 'prestation:b'])
    // La principale devient b : les options de a n'ont plus de sens.
    expect(appliquerPrestations([b, a], v, 'a').vehicules[0].addons?.map(x => x.id)).toEqual(['prestation:a'])
  })

  it('ne laisse rien quand plus aucune prestation n’est cochée', () => {
    const r = appliquerPrestations([], [{ type: 'citadine', addons: [{ id: 'prestation:b', label: 'b', price: 1, category: 'prestation' }] }])
    expect(r.service_id).toBe('')
    expect(r.vehicules[0].addons).toEqual([])
  })

  describe('normaliserPrestationsSupplementaires', () => {
    const lave = { ...service('b', { vehicle_price_overrides: { SUV: 90 } }), washer_id: 'w1', name: 'Jantes' }
    const catalogue = new Map<string, PrestationCatalogue>([['b', lave], ['v', { ...service('v'), washer_id: 'w1', en_veille: true }], ['x', { ...service('x'), washer_id: 'w2' }]])
    const base = { catalogue, washerId: 'w1', principaleId: 'a', autorise: true, typeParDefaut: 'citadine' }
    const faux = (id: string) => ({ id: `prestation:${id}`, label: 'truqué', price: 0.01, category: 'prestation', duration_minutes: 1 })

    it('laisse passer une réservation sans prestation supplémentaire, même si le réglage est éteint', () => {
      const vehicules = [{ type: 'citadine', addons: [{ id: 'cire', label: 'Cire', price: 10, category: 'x' }] }]
      expect(normaliserPrestationsSupplementaires({ ...base, autorise: false, vehicules, communes: undefined })).toEqual({ ok: true, vehicules, communes: undefined })
    })

    it('jette nom, prix et durée du navigateur et relit le catalogue, au prix du type', () => {
      const r = normaliserPrestationsSupplementaires({ ...base, vehicules: [{ type: 'citadine', addons: [faux('b')] }, { type: 'SUV', addons: [faux('b')] }], communes: undefined })
      expect(r.ok && r.vehicules?.map(v => v.addons)).toEqual([
        [{ id: 'prestation:b', label: 'Jantes', price: 50, category: 'prestation', duration_minutes: 60 }],
        [{ id: 'prestation:b', label: 'Jantes', price: 90, category: 'prestation', duration_minutes: 60 }],
      ])
    })

    it('refuse quand le laveur n’a pas allumé le réglage', () => {
      expect(normaliserPrestationsSupplementaires({ ...base, autorise: false, vehicules: [{ type: 'citadine', addons: [faux('b')] }], communes: undefined }).ok).toBe(false)
    })

    it('refuse une prestation d’un autre laveur, en veille, inconnue ou déjà principale', () => {
      for (const id of ['x', 'v', 'inconnue', 'a']) {
        expect(normaliserPrestationsSupplementaires({ ...base, vehicules: [{ type: 'citadine', addons: [faux(id)] }], communes: undefined }).ok).toBe(false)
      }
    })

    it('refuse une prestation non proposée pour le type du véhicule', () => {
      const r = normaliserPrestationsSupplementaires({ ...base, vehicules: [{ type: 'moto', addons: [faux('b')] }], communes: undefined })
      expect(r.ok).toBe(false)
    })

    it('retire les doublons', () => {
      const r = normaliserPrestationsSupplementaires({ ...base, vehicules: [{ type: 'citadine', addons: [faux('b'), faux('b')] }], communes: undefined })
      expect(r.ok && r.vehicules?.[0].addons).toHaveLength(1)
    })

    it('refuse plus de prestations que le maximum', () => {
      const cat = new Map<string, PrestationCatalogue>(Array.from({ length: 8 }, (_, i) => [`p${i}`, { ...service(`p${i}`), washer_id: 'w1' }] as const))
      const addons = Array.from({ length: 8 }, (_, i) => faux(`p${i}`))
      expect(normaliserPrestationsSupplementaires({ ...base, catalogue: cat, vehicules: [{ type: 'citadine', addons }], communes: undefined }).ok).toBe(false)
    })
  })

  describe('limites combinées', () => {
    it('sans limite, aucune contrainte', () => {
      expect(limitesCombinees([{}, { lieu_restreint: null, heures_debut: [], centres_ids: null }])).toEqual({ lieu: null, heures: null, centres: null })
    })

    it('garde la limite posée par l’une des prestations', () => {
      expect(limitesCombinees([{ lieu_restreint: 'centre' }, {}])?.lieu).toBe('centre')
    })

    it('refuse un lieu contradictoire', () => {
      expect(prestationsCompatibles([{ lieu_restreint: 'centre' }, { lieu_restreint: 'domicile' }])).toBe(false)
      expect(prestationsCompatibles([{ lieu_restreint: 'centre' }, { lieu_restreint: 'centre' }])).toBe(true)
    })

    it('croise les heures de début et refuse un croisement vide', () => {
      expect(limitesCombinees([{ heures_debut: ['08:30', '13:00', '16:00'] }, { heures_debut: ['13:00', '16:00', '17:00'] }])?.heures).toEqual(['13:00', '16:00'])
      expect(limitesCombinees([{ heures_debut: ['08:30'] }, { heures_debut: ['13:00'] }])).toBeNull()
      expect(limitesCombinees([{ heures_debut: ['08:30'] }, {}])?.heures).toEqual(['08:30'])
    })

    it('croise les centres autorisés', () => {
      expect(limitesCombinees([{ centres_ids: ['a', 'b'] }, { centres_ids: ['b'] }])?.centres).toEqual(['b'])
      expect(prestationsCompatibles([{ centres_ids: ['a'] }, { centres_ids: ['b'] }])).toBe(false)
    })
  })
})

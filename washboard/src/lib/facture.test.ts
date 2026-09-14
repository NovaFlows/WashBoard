import { describe, it, expect } from 'vitest'
import {
  siretValide, numeroTvaValide, infosFacturationManquantes, phraseManques,
  lignesFacture, totauxFacture, construireFacture,
  type ReservationFacturable, type VendeurFacturable,
} from './facture'

const reservation = (surcharge: Partial<ReservationFacturable> = {}): ReservationFacturable => ({
  client_name: 'Client Démo',
  client_email: 'client@example.com',
  address: '1 rue de la Démo, 75000 Paris',
  scheduled_at: '2026-09-20T09:00:00.000Z',
  is_professional: false,
  company_name: null,
  siret: null,
  billing_address: null,
  booked_price: 115,
  is_smart_slot: false,
  smart_discount: 0,
  vehicle_count: 2,
  travel_fee: 15,
  vehicles_detail: [
    { type: 'citadine', count: 1, unit_price: 40 },
    { type: 'SUV', count: 1, unit_price: 45, label: 'SUV / 4x4' },
  ],
  selected_addons: [{ label: 'Poils d’animaux', price: 15 }],
  services: { name: 'Lavage complet' },
  ...surcharge,
})

const vendeur = (surcharge: Partial<VendeurFacturable> = {}): VendeurFacturable => ({
  name: 'Démo Lavage',
  phone: null,
  facture_nom_legal: 'Jean Démo EI',
  facture_siret: '123 456 789 00007',
  facture_adresse: '2 avenue de la Démo, 69000 Lyon',
  facture_regime_tva: 'franchise',
  facture_taux_tva: 20,
  facture_numero_tva: null,
  ...surcharge,
})

describe('siretValide', () => {
  it('accepte un SIRET dont la clé est juste, espaces compris', () => {
    expect(siretValide('12345678900007')).toBe(true)
    expect(siretValide('123 456 789 00007')).toBe(true)
  })

  it('refuse une faute de frappe sur un chiffre', () => {
    expect(siretValide('12345678900008')).toBe(false)
  })

  it('refuse une longueur ou des caractères invalides', () => {
    expect(siretValide('123456789')).toBe(false)
    expect(siretValide('1234567890000A')).toBe(false)
  })

  it('applique la règle particulière de La Poste', () => {
    expect(siretValide('35600000049837')).toBe(true)
  })
})

describe('numeroTvaValide', () => {
  it('accepte un numéro français, espaces et minuscules compris', () => {
    expect(numeroTvaValide('fr 32 123456789')).toBe(true)
  })

  it('refuse un numéro sans le SIREN complet', () => {
    expect(numeroTvaValide('FR32123')).toBe(false)
  })
})

describe('infosFacturationManquantes', () => {
  it('rien ne manque pour un micro-entrepreneur complet', () => {
    expect(infosFacturationManquantes(vendeur())).toEqual([])
  })

  it('liste ce qui manque, SIRET faux compris', () => {
    expect(infosFacturationManquantes(vendeur({ facture_nom_legal: ' ', facture_siret: '123', facture_adresse: null })))
      .toEqual(['votre nom légal', 'votre SIRET', 'votre adresse professionnelle'])
  })

  it('exige le numéro de TVA de celui qui la facture', () => {
    expect(infosFacturationManquantes(vendeur({ facture_regime_tva: 'assujetti' })))
      .toEqual(['votre numéro de TVA'])
  })

  it('formule une phrase lisible', () => {
    expect(phraseManques(['votre SIRET', 'votre adresse professionnelle']))
      .toBe('Pour émettre vos factures, il manque votre SIRET et votre adresse professionnelle.')
    expect(phraseManques([])).toBeNull()
  })
})

describe('lignesFacture', () => {
  it('une ligne par véhicule, par option et pour le déplacement', () => {
    expect(lignesFacture(reservation())).toEqual([
      { designation: 'Lavage complet — Citadine', quantite: 1, prixUnitaireTtc: 40, totalTtc: 40 },
      { designation: 'Lavage complet — SUV / 4x4', quantite: 1, prixUnitaireTtc: 45, totalTtc: 45 },
      { designation: 'Option : Poils d’animaux', quantite: 1, prixUnitaireTtc: 15, totalTtc: 15 },
      { designation: 'Frais de déplacement', quantite: 1, prixUnitaireTtc: 15, totalTtc: 15 },
    ])
  })

  it('sans détail par véhicule, déduit le prix unitaire du total', () => {
    const lignes = lignesFacture(reservation({ vehicles_detail: null, selected_addons: [], travel_fee: 0, booked_price: 90 }))
    expect(lignes).toEqual([{ designation: 'Lavage complet', quantite: 2, prixUnitaireTtc: 45, totalTtc: 90 }])
  })

  it('si le détail ne retombe pas sur le total enregistré, facture le total en une ligne', () => {
    const lignes = lignesFacture(reservation({ booked_price: 100 }))
    expect(lignes).toEqual([{ designation: 'Lavage complet', quantite: 1, prixUnitaireTtc: 100, totalTtc: 100 }])
  })
})

describe('totauxFacture', () => {
  it('en franchise, pas de TVA : HT = TTC', () => {
    expect(totauxFacture(115, 'franchise', 0)).toEqual({ ht: 115, tva: 0, ttc: 115 })
  })

  it('assujetti à 20 % : le TTC payé est conservé, HT et TVA en découlent', () => {
    expect(totauxFacture(120, 'assujetti', 20)).toEqual({ ht: 100, tva: 20, ttc: 120 })
    const t = totauxFacture(49.9, 'assujetti', 20)
    expect(t.ttc).toBe(49.9)
    expect(t.ht + t.tva).toBeCloseTo(49.9, 10)
  })
})

describe('construireFacture', () => {
  it('fige le vendeur, le client et les totaux, remise « créneau optimisé » déduite', () => {
    const f = construireFacture(reservation({ is_smart_slot: true, smart_discount: 10 }), vendeur())
    expect(f.vendeur).toMatchObject({ nomLegal: 'Jean Démo EI', siret: '12345678900007', regimeTva: 'franchise', tauxTva: 0 })
    expect(f.remiseTtc).toBe(10)
    expect(f.totaux).toEqual({ ht: 105, tva: 0, ttc: 105 })
    expect(f.client.adresseFacturation).toBe('1 rue de la Démo, 75000 Paris')
  })

  it('client professionnel : raison sociale, SIREN tiré du SIRET, adresse de facturation', () => {
    const f = construireFacture(reservation({
      is_professional: true, company_name: 'Flotte Démo SAS', siret: '123 456 789 00007',
      billing_address: '3 place de la Démo, 33000 Bordeaux',
    }), vendeur())
    expect(f.client).toMatchObject({
      professionnel: true, entreprise: 'Flotte Démo SAS', siren: '123456789',
      adresseFacturation: '3 place de la Démo, 33000 Bordeaux',
    })
  })

  it('laveur qui facture la TVA : taux et numéro portés sur la facture', () => {
    const f = construireFacture(reservation(), vendeur({ facture_regime_tva: 'assujetti', facture_numero_tva: 'fr32 123456789' }))
    expect(f.vendeur).toMatchObject({ regimeTva: 'assujetti', tauxTva: 20, numeroTva: 'FR32123456789' })
    expect(f.totaux.ttc).toBe(115)
    expect(f.totaux.ht).toBe(95.83)
  })

  it('une remise ne peut pas dépasser le montant facturé', () => {
    const f = construireFacture(reservation({ is_smart_slot: true, smart_discount: 500 }), vendeur())
    expect(f.totaux.ttc).toBe(0)
  })
})

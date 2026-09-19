import { describe, it, expect } from 'vitest'
import {
  vehiclePrice, hasPriceOverrides, minVehiclePrice, addonsDuration, effectiveDuration,
  smartDiscountAmount, smartPrice, finalDisplayPrice, formatPrice,
  optionsParVehicule, dureeTotale, prixOptions,
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

// Bug prod : un type "sur devis" (0€, ex. tapis à chiffrer au cas par cas)
// faisait afficher « à partir de 0€ » alors que les autres types ont un vrai prix.
describe('type "sur devis" à 0€ (pas encore de tarif fixe)', () => {
  const withDevis = {
    price: 60,
    vehicle_types: ['2_places', '3_4_places', 'tapis_devis'],
    vehicle_price_overrides: { '2_places': 80, '3_4_places': 100, tapis_devis: 0 },
  }
  it('ignore le type à 0€ pour le minimum affiché', () => {
    expect(minVehiclePrice(withDevis)).toBe(80) // pas 0
  })
  it('retombe sur 0 si vraiment tous les types sont à 0€', () => {
    const toutDevis = { price: 60, vehicle_types: ['a', 'b'], vehicle_price_overrides: { a: 0, b: 0 } }
    expect(minVehiclePrice(toutDevis)).toBe(0)
  })
})

describe('addonsDuration', () => {
  it('retourne 0 sans options', () => {
    expect(addonsDuration([])).toBe(0)
  })
  it('retourne 0 si null ou undefined', () => {
    expect(addonsDuration(null)).toBe(0)
    expect(addonsDuration(undefined)).toBe(0)
  })
  it('ignore les options sans duration_minutes', () => {
    expect(addonsDuration([{}])).toBe(0)
  })
  it('somme les durées des options', () => {
    expect(addonsDuration([{ duration_minutes: 15 }, { duration_minutes: 30 }])).toBe(45)
  })
  it('ignore les options sans durée dans un tableau mixte', () => {
    expect(addonsDuration([{ duration_minutes: 15 }, {}])).toBe(15)
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

describe('effectiveDuration + addonsDuration — options avec durée', () => {
  it('option vomi +15 min pour 1 véhicule → 90+15=105 min', () => {
    expect(effectiveDuration(90 + addonsDuration([{ duration_minutes: 15 }]), 1)).toBe(105)
  })
  it('deux options pour 2 véhicules → (90+45)×2=270 min', () => {
    expect(effectiveDuration(90 + addonsDuration([{ duration_minutes: 15 }, { duration_minutes: 30 }]), 2)).toBe(270)
  })
  it('sans options → comportement inchangé', () => {
    expect(effectiveDuration(90 + addonsDuration([]), 2)).toBe(180)
    expect(effectiveDuration(90 + addonsDuration(null), 2)).toBe(180)
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

describe('formatPrice', () => {
  it('supprime les décimales .00', () => {
    expect(formatPrice(30)).toBe('30€')
    expect(formatPrice(30.00)).toBe('30€')
  })
  it('conserve les décimales non nulles', () => {
    expect(formatPrice(30.5)).toBe('30.50€')
    expect(formatPrice(9.99)).toBe('9.99€')
  })
  it('inclut toujours le signe €', () => {
    expect(formatPrice(0)).toBe('0€')
  })
})

// ── Options par véhicule ───────────────────────────────────────────────────
//
// Ces tests protègent surtout une chose : une réservation enregistrée AVANT ce
// changement doit continuer à donner exactement les mêmes chiffres. Des
// factures déjà émises en dépendent.

describe('optionsParVehicule', () => {
  it('reconnaît une réservation à l’ancien format', () => {
    expect(optionsParVehicule(null)).toBe(false)
    expect(optionsParVehicule([])).toBe(false)
    expect(optionsParVehicule([{ count: 2 }])).toBe(false)
  })

  it('une liste d’options vide est un choix explicite, pas une absence', () => {
    // Le client a vu les options de cette voiture et n'en a coché aucune :
    // c'est du nouveau format, et sa durée ne doit pas repasser par l'ancien
    // calcul qui multiplierait les options des autres véhicules.
    expect(optionsParVehicule([{ count: 1, addons: [] }])).toBe(true)
  })

  it('un seul véhicule porteur d’options suffit', () => {
    expect(optionsParVehicule([{ count: 1 }, { count: 1, addons: [{ price: 20 }] }])).toBe(true)
  })
})

describe('dureeTotale', () => {
  it('ancien format : options communes, multipliées par le nombre de véhicules', () => {
    // Comportement historique, préservé tel quel.
    expect(dureeTotale(180, null, [{ duration_minutes: 30 }], 2)).toBe(420)
    expect(dureeTotale(180, null, null, 1)).toBe(180)
    expect(dureeTotale(180, null, null, null)).toBe(180)
  })

  it('nouveau format : chaque voiture ne compte que ses propres options', () => {
    // Le cas qui a motivé le changement : nettoyage de vomi sur UNE des deux
    // voitures. Avant : (180+30)×2 = 420 min bloquées. Maintenant : 390.
    const vehicules = [
      { count: 1, addons: [{ duration_minutes: 30 }] },
      { count: 1, addons: [] },
    ]
    expect(dureeTotale(180, vehicules, null, 2)).toBe(390)
  })

  it('nouveau format : un même véhicule en plusieurs exemplaires multiplie ses options', () => {
    // Deux citadines identiques avec la même option : là, ça se multiplie bien.
    expect(dureeTotale(180, [{ count: 2, addons: [{ duration_minutes: 30 }] }], null, 2)).toBe(420)
  })

  it('nouveau format : aucune option cochée nulle part', () => {
    expect(dureeTotale(180, [{ count: 1, addons: [] }, { count: 1, addons: [] }], null, 2)).toBe(360)
  })

  it('ignore les options communes dès que le détail par véhicule existe', () => {
    // Sinon on compterait deux fois : une fois par véhicule, une fois en commun.
    const vehicules = [{ count: 1, addons: [{ duration_minutes: 30 }] }]
    expect(dureeTotale(180, vehicules, [{ duration_minutes: 999 }], 1)).toBe(210)
  })
})

describe('prixOptions', () => {
  it('ancien format : comptées une seule fois, quel que soit le nombre de voitures', () => {
    // On ne réécrit pas le prix qu'un client a vu et payé.
    expect(prixOptions(null, [{ price: 40 }, { price: 20 }], 3)).toBe(60)
  })

  it('nouveau format : seules les voitures concernées paient', () => {
    const vehicules = [
      { count: 1, addons: [{ price: 40 }] },
      { count: 1, addons: [] },
    ]
    expect(prixOptions(vehicules, null, 2)).toBe(40)
  })

  it('nouveau format : la même option sur deux exemplaires se paie deux fois', () => {
    expect(prixOptions([{ count: 2, addons: [{ price: 40 }] }], null, 2)).toBe(80)
  })

  it('tolère une option sans prix', () => {
    expect(prixOptions([{ count: 1, addons: [{ duration_minutes: 30 }] }], null, 1)).toBe(0)
  })
})

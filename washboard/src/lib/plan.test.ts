import { describe, it, expect } from 'vitest'
import {
  hasFeature, washerPlan, requiredPlanLabel,
  yearlyPrice, yearlyMonthlyEquivalent, formatEuros,
} from './plan'

describe('washerPlan', () => {
  it('renvoie le plan valide', () => {
    expect(washerPlan({ plan: 'pro' })).toBe('pro')
    expect(washerPlan({ plan: 'essentiel' })).toBe('essentiel')
  })
  it('retombe sur essentiel pour un plan supprimé', () => {
    expect(washerPlan({ plan: 'business' })).toBe('essentiel')
  })
  it('retombe sur essentiel si plan absent ou invalide', () => {
    expect(washerPlan(null)).toBe('essentiel')
    expect(washerPlan({})).toBe('essentiel')
    expect(washerPlan({ plan: 'n_importe_quoi' })).toBe('essentiel')
  })
})

describe('hasFeature — plan essentiel', () => {
  const w = { plan: 'essentiel', grandfathered: false }
  it('autorise les avis email', () => expect(hasFeature(w, 'avis_email')).toBe(true))
  it('bloque la compta', () => expect(hasFeature(w, 'compta')).toBe(false))
  it('bloque les avis SMS', () => expect(hasFeature(w, 'avis_sms')).toBe(false))
  it('bloque le multi-laveurs', () => expect(hasFeature(w, 'multi_laveurs')).toBe(false))
})

describe('hasFeature — plan pro', () => {
  const w = { plan: 'pro', grandfathered: false }
  it('autorise tout', () => {
    expect(hasFeature(w, 'compta')).toBe(true)
    expect(hasFeature(w, 'avis_sms')).toBe(true)
    expect(hasFeature(w, 'multi_laveurs')).toBe(true)
  })
})

describe('hasFeature — grandfathered', () => {
  it('débloque tout, même sur le plan essentiel', () => {
    const w = { plan: 'essentiel', grandfathered: true }
    expect(hasFeature(w, 'compta')).toBe(true)
    expect(hasFeature(w, 'avis_sms')).toBe(true)
    expect(hasFeature(w, 'multi_laveurs')).toBe(true)
  })
})

describe('requiredPlanLabel', () => {
  it('renvoie le bon plan minimum requis', () => {
    expect(requiredPlanLabel('avis_email')).toBe('Essentiel')
    expect(requiredPlanLabel('compta')).toBe('Pro')
    expect(requiredPlanLabel('avis_sms')).toBe('Pro')
    expect(requiredPlanLabel('multi_laveurs')).toBe('Pro')
  })
})

describe('tarifs annuels', () => {
  it('facture 10 mois pour 12 (2 mois offerts)', () => {
    expect(yearlyPrice(49)).toBe(490)
    expect(yearlyPrice(69)).toBe(690)
  })
  it('calcule le mensuel équivalent arrondi au centime', () => {
    expect(yearlyMonthlyEquivalent(49)).toBe(40.83)
    expect(yearlyMonthlyEquivalent(69)).toBe(57.5)
  })
  it('formate à la française sans centimes inutiles', () => {
    expect(formatEuros(40.83)).toBe('40,83')
    expect(formatEuros(490)).toBe('490')
  })
  it('complète les centimes manquants sur un montant non rond', () => {
    expect(formatEuros(57.5)).toBe('57,50')
  })
})

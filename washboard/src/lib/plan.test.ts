import { describe, it, expect } from 'vitest'
import { hasFeature, washerPlan, requiredPlanLabel } from './plan'

describe('washerPlan', () => {
  it('renvoie le plan valide', () => {
    expect(washerPlan({ plan: 'pro' })).toBe('pro')
    expect(washerPlan({ plan: 'business' })).toBe('business')
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
  it('autorise la compta', () => expect(hasFeature(w, 'compta')).toBe(true))
  it('autorise les avis SMS', () => expect(hasFeature(w, 'avis_sms')).toBe(true))
  it('bloque le multi-laveurs', () => expect(hasFeature(w, 'multi_laveurs')).toBe(false))
})

describe('hasFeature — plan business', () => {
  const w = { plan: 'business', grandfathered: false }
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
    expect(requiredPlanLabel('multi_laveurs')).toBe('Business')
  })
})

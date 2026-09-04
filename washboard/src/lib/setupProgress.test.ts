import { describe, it, expect } from 'vitest'
import { computeSetupProgress, type SetupInput } from './setupProgress'

const complet: SetupInput = {
  servicesCount: 3,
  availabilitiesCount: 5,
  baseAddress: '12 rue des Lilas, Cergy',
  phone: '0612345678',
  logoUrl: 'https://exemple.test/logo.png',
}

describe('computeSetupProgress', () => {
  it('annonce 100 % quand tout l’essentiel est en place', () => {
    const r = computeSetupProgress(complet)
    expect(r.percent).toBe(100)
    expect(r.complete).toBe(true)
    expect(r.missing).toEqual([])
  })

  it('annonce 0 % sur un compte vide', () => {
    const r = computeSetupProgress({
      servicesCount: 0, availabilitiesCount: 0,
      baseAddress: null, phone: null, logoUrl: null,
    })
    expect(r.percent).toBe(0)
    expect(r.missing).toHaveLength(5)
  })

  it('signale les prestations manquantes même quand tout le reste est fait', () => {
    // Cas réel : logo, adresse et 28 créneaux configurés, zéro prestation.
    // La page publique ne proposait rien, et rien ne le disait au laveur.
    const r = computeSetupProgress({ ...complet, servicesCount: 0 })
    expect(r.complete).toBe(false)
    expect(r.missing.map(m => m.key)).toEqual(['services'])
    expect(r.missing[0].blocking).toBe(true)
  })

  it('fait remonter les points bloquants avant les autres', () => {
    // On ne demande pas à quelqu'un d'ajouter son logo tant que sa page ne
    // peut pas encaisser une réservation.
    const r = computeSetupProgress({
      ...complet, logoUrl: null, phone: null, availabilitiesCount: 0,
    })
    expect(r.missing[0].key).toBe('availabilities')
    expect(r.missing[0].blocking).toBe(true)
    expect(r.missing.slice(1).every(m => !m.blocking)).toBe(true)
  })

  it('ne compte pas les réglages facultatifs', () => {
    // Les frais de déplacement, les créneaux intelligents ou les relances
    // n'entrent pas dans le calcul : un laveur qui ne s'en sert pas ne doit
    // pas se croire en retard.
    const r = computeSetupProgress(complet)
    expect(r.items.map(i => i.key).sort()).toEqual(
      ['availabilities', 'baseAddress', 'logo', 'phone', 'services']
    )
  })

  it('traite une chaîne d’espaces comme non renseignée', () => {
    const r = computeSetupProgress({ ...complet, baseAddress: '   ', phone: '' })
    expect(r.missing.map(m => m.key).sort()).toEqual(['baseAddress', 'phone'])
  })

  it('donne un pourcentage entier, jamais à virgule', () => {
    // Il s'affiche tel quel dans l'interface : « 60 % », pas « 60.000001 % ».
    const r = computeSetupProgress({ ...complet, servicesCount: 0, phone: null })
    expect(Number.isInteger(r.percent)).toBe(true)
    expect(r.percent).toBe(60)
  })

  it('donne à chaque manque une page où le corriger', () => {
    const r = computeSetupProgress({
      servicesCount: 0, availabilitiesCount: 0,
      baseAddress: null, phone: null, logoUrl: null,
    })
    expect(r.missing.every(m => m.href.startsWith('/dashboard'))).toBe(true)
  })
})

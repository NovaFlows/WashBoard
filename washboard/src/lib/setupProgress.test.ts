import { describe, it, expect } from 'vitest'
import {
  computeSetupProgress,
  ESSENTIAL_WEIGHT,
  OPTIONAL_WEIGHT,
  type SetupInput,
} from './setupProgress'

const essentielsOk = {
  servicesCount: 3,
  availabilitiesCount: 5,
  baseAddress: '12 rue des Lilas, Cergy',
  phone: '0612345678',
  logoUrl: 'https://exemple.test/logo.png',
}

const confortVide = {
  googleCalendarConnected: false,
  reviewsEnabled: false,
  followupEnabled: false,
  zoneEnabled: false,
  smartSlotEnabled: false,
  welcomeMessage: null,
}

const confortOk = {
  googleCalendarConnected: true,
  reviewsEnabled: true,
  followupEnabled: true,
  zoneEnabled: true,
  smartSlotEnabled: true,
  welcomeMessage: 'Bienvenue !',
}

const vide: SetupInput = {
  servicesCount: 0, availabilitiesCount: 0,
  baseAddress: null, phone: null, logoUrl: null,
  ...confortVide,
}

describe('computeSetupProgress — pondération', () => {
  it('atteint 80 % avec l’essentiel seul', () => {
    // C'est tout l'objet de la pondération : un laveur pleinement opérationnel
    // mais qui n'a activé aucun réglage de confort ne doit pas se croire à la
    // traîne. À égalité de poids, il aurait lu 45 %.
    const r = computeSetupProgress({ ...essentielsOk, ...confortVide })
    expect(r.percent).toBe(ESSENTIAL_WEIGHT)
    expect(r.essentialsDone).toBe(true)
    expect(r.complete).toBe(false)
  })

  it('atteint 100 % quand tout est configuré', () => {
    const r = computeSetupProgress({ ...essentielsOk, ...confortOk })
    expect(r.percent).toBe(100)
    expect(r.complete).toBe(true)
    expect(r.missing).toEqual([])
  })

  it('plafonne à 20 % avec le confort seul', () => {
    // Un compte sans prestations reste visiblement bas, même s'il a activé
    // toutes les options.
    const r = computeSetupProgress({
      servicesCount: 0, availabilitiesCount: 0,
      baseAddress: null, phone: null, logoUrl: null,
      ...confortOk,
    })
    expect(r.percent).toBe(OPTIONAL_WEIGHT)
    expect(r.essentialsDone).toBe(false)
  })

  it('annonce 0 % sur un compte vide', () => {
    const r = computeSetupProgress(vide)
    expect(r.percent).toBe(0)
    expect(r.missing).toHaveLength(11)
  })

  it('donne plus de poids à une prestation qu’à un message d’accueil', () => {
    const sansPrestations = computeSetupProgress({
      ...essentielsOk, servicesCount: 0, ...confortOk,
    })
    const sansAccueil = computeSetupProgress({
      ...essentielsOk, ...confortOk, welcomeMessage: null,
    })
    expect(sansPrestations.percent).toBeLessThan(sansAccueil.percent)
  })
})

describe('computeSetupProgress — ce qui manque', () => {
  it('signale les prestations même quand tout le reste est fait', () => {
    // Cas réel : logo, adresse et 28 créneaux configurés, zéro prestation.
    const r = computeSetupProgress({ ...essentielsOk, servicesCount: 0, ...confortOk })
    expect(r.missing.map(m => m.key)).toEqual(['services'])
    expect(r.missing[0].blocking).toBe(true)
  })

  it('range les manques : bloquants, puis essentiels, puis confort', () => {
    const r = computeSetupProgress({
      ...essentielsOk, availabilitiesCount: 0, logoUrl: null,
      ...confortOk, zoneEnabled: false,
    })
    expect(r.missing.map(m => m.key)).toEqual(['availabilities', 'logo', 'zone'])
  })

  it('n’inclut jamais les frais de déplacement', () => {
    // Exclus volontairement : un laveur qui ne facture pas le déplacement n'a
    // rien à configurer et ne doit pas être pénalisé.
    const r = computeSetupProgress(vide)
    expect(r.items.some(i => /déplacement|travel/i.test(i.key + i.label))).toBe(false)
  })

  it('couvre les six réglages de confort demandés', () => {
    const r = computeSetupProgress(vide)
    const confort = r.items.filter(i => !i.essential).map(i => i.key).sort()
    expect(confort).toEqual(['calendar', 'followup', 'reviews', 'smartSlot', 'welcome', 'zone'])
  })
})

describe('computeSetupProgress — robustesse', () => {
  it('traite une chaîne d’espaces comme non renseignée', () => {
    const r = computeSetupProgress({
      ...essentielsOk, baseAddress: '   ', phone: '',
      ...confortOk, welcomeMessage: '  ',
    })
    expect(r.missing.map(m => m.key).sort()).toEqual(['baseAddress', 'phone', 'welcome'])
  })

  it('donne un pourcentage entier, jamais à virgule', () => {
    // Il s'affiche tel quel : « 63 % », pas « 63.33333 % ».
    const r = computeSetupProgress({
      ...essentielsOk, servicesCount: 0, ...confortVide, zoneEnabled: true,
    })
    expect(Number.isInteger(r.percent)).toBe(true)
  })

  it('donne à chaque manque une page où le corriger', () => {
    const r = computeSetupProgress(vide)
    expect(r.missing.every(m => m.href.startsWith('/dashboard'))).toBe(true)
  })
})

describe('computeSetupProgress — destinations', () => {
  it('envoie chaque manque vers sa section, pas vers le haut d’une page', () => {
    // Sans ancre, le laveur atterrissait en haut d'un ecran et devait
    // retrouver lui-meme le reglage : le raccourci ne servait a rien.
    const r = computeSetupProgress(vide)
    expect(r.missing.every(m => m.href.includes('#'))).toBe(true)
  })

  it('ne pointe que vers des pages du tableau de bord', () => {
    const r = computeSetupProgress(vide)
    expect(r.missing.every(m => m.href.startsWith('/dashboard'))).toBe(true)
  })
})

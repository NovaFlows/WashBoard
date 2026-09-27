import { describe, it, expect } from 'vitest'
import {
  ecrireMasques, lireMasques, nettoyerMasques, nombreMasques, peutEtreMasque, phraseMasques,
  reglagesAffiches,
} from '@/lib/reglagesMasques'
import { computeSetupProgress } from '@/lib/setupProgress'
import type { SetupItem } from '@/lib/setupProgress'

const item = (p: Partial<SetupItem>): SetupItem => ({
  key: 'reviews', label: 'La demande d’avis Google', done: false,
  blocking: false, essential: false, href: '/x', hrefV2: '/y', ...p,
})

const VIDE = {
  servicesCount: 0, availabilitiesCount: 0, baseAddress: null, phone: null, logoUrl: null,
  googleCalendarConnected: false, reviewsEnabled: false, followupEnabled: false,
  zoneEnabled: false, smartSlotEnabled: false, welcomeMessage: null,
}

describe('ce qui peut être écarté', () => {
  it('un réglage de confort, oui', () => {
    expect(peutEtreMasque(item({}))).toBe(true)
  })

  it('un réglage indispensable, jamais — la page ne prendrait plus de rendez-vous', () => {
    expect(peutEtreMasque(item({ key: 'services', blocking: true, essential: true }))).toBe(false)
    expect(peutEtreMasque(item({ key: 'phone', essential: true }))).toBe(false)
  })

  it('sur le vrai calcul, seuls les réglages de confort sont écartables', () => {
    const r = computeSetupProgress(VIDE)
    const ecartables = r.items.filter(peutEtreMasque).map(i => i.key)
    expect(ecartables).not.toContain('services')
    expect(ecartables).not.toContain('availabilities')
    expect(ecartables).not.toContain('baseAddress')
    expect(ecartables).toContain('reviews')
    expect(ecartables).toContain('followup')
  })
})

describe('lecture et écriture', () => {
  it('relit ce qu’on a écrit, sans doublon', () => {
    expect(lireMasques(ecrireMasques(['reviews', 'followup', 'reviews']))).toEqual(['reviews', 'followup'])
  })

  it('une valeur absente ou abîmée ne masque rien plutôt que de planter', () => {
    expect(lireMasques(null)).toEqual([])
    expect(lireMasques('pas du json')).toEqual([])
    expect(lireMasques('{"a":1}')).toEqual([])
    expect(lireMasques('[1, "reviews", null]')).toEqual(['reviews'])
  })
})

describe('ce que la carte montre', () => {
  const manques = [item({ key: 'reviews' }), item({ key: 'followup' }), item({ key: 'zone' })]

  it('retire les réglages écartés de la liste', () => {
    expect(reglagesAffiches(manques, ['reviews']).map(i => i.key)).toEqual(['followup', 'zone'])
  })

  it('compte ce qui est écarté — c’est ce qui explique l’écart à 100 %', () => {
    expect(nombreMasques(manques, ['reviews', 'zone'])).toBe(2)
    expect(phraseMasques(2)).toBe('2 réglages non faits, masqués')
    expect(phraseMasques(1)).toBe('1 réglage non fait, masqué')
  })

  it('ne compte pas un réglage écarté puis fait entre-temps', () => {
    // « reviews » n'est plus dans les manques : il a été activé.
    expect(nombreMasques([item({ key: 'followup' })], ['reviews', 'followup'])).toBe(1)
  })
})

describe('nettoyerMasques', () => {
  it('oublie les clés de réglages qui ne manquent plus', () => {
    const manques = [item({ key: 'followup' })]
    expect(nettoyerMasques(manques, ['reviews', 'followup'])).toEqual(['followup'])
  })

  it('un réglage écarté puis défait redevient visible', () => {
    // Il est sorti des masques au passage précédent : rien ne le cache plus.
    const masquesNettoyes = nettoyerMasques([], ['reviews'])
    expect(masquesNettoyes).toEqual([])
    expect(reglagesAffiches([item({ key: 'reviews' })], masquesNettoyes).map(i => i.key))
      .toEqual(['reviews'])
  })
})

describe('le pourcentage ne bouge pas', () => {
  it('masquer n’est pas faire : la barre reste la même', () => {
    const avant = computeSetupProgress(VIDE).percent
    // Masquer n'entre nulle part dans le calcul — c'est un choix d'affichage.
    const apres = computeSetupProgress(VIDE).percent
    expect(apres).toBe(avant)
    expect(avant).toBe(0)
  })
})

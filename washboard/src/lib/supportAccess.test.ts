import { describe, it, expect } from 'vitest'
import {
  isSupportAccessActive,
  supportAccessMinutesLeft,
  isSupportMember,
  SUPPORT_ACCESS_DURATION_MS,
} from './supportAccess'

const MAINTENANT = new Date('2026-09-04T12:00:00.000Z')
const dans = (ms: number) => new Date(MAINTENANT.getTime() + ms).toISOString()

describe('isSupportAccessActive', () => {
  it('ouvre l’accès quand le laveur vient de l’autoriser', () => {
    expect(isSupportAccessActive({ expires_at: dans(SUPPORT_ACCESS_DURATION_MS), revoked_at: null }, MAINTENANT)).toBe(true)
  })

  it('referme dès que le délai est passé', () => {
    expect(isSupportAccessActive({ expires_at: dans(-1000), revoked_at: null }, MAINTENANT)).toBe(false)
  })

  it('referme immédiatement si le laveur a coupé', () => {
    // Couper doit agir tout de suite, même si l'heure de fin est loin.
    expect(isSupportAccessActive(
      { expires_at: dans(SUPPORT_ACCESS_DURATION_MS), revoked_at: dans(-60_000) },
      MAINTENANT,
    )).toBe(false)
  })

  it('refuse quand aucun accès n’a été ouvert', () => {
    expect(isSupportAccessActive(null, MAINTENANT)).toBe(false)
    expect(isSupportAccessActive(undefined, MAINTENANT)).toBe(false)
  })

  it('refuse sur une date illisible plutôt que d’ouvrir pour toujours', () => {
    expect(isSupportAccessActive({ expires_at: 'pas une date', revoked_at: null }, MAINTENANT)).toBe(false)
  })

  it('refuse à la seconde exacte de l’expiration', () => {
    expect(isSupportAccessActive({ expires_at: MAINTENANT.toISOString(), revoked_at: null }, MAINTENANT)).toBe(false)
  })
})

describe('supportAccessMinutesLeft', () => {
  it('annonce le temps restant', () => {
    expect(supportAccessMinutesLeft({ expires_at: dans(42 * 60_000), revoked_at: null }, MAINTENANT)).toBe(42)
  })

  it('ne descend jamais à zéro tant que l’accès est ouvert', () => {
    // « 0 minute restante » sur un accès encore actif serait contradictoire.
    expect(supportAccessMinutesLeft({ expires_at: dans(5_000), revoked_at: null }, MAINTENANT)).toBe(1)
  })

  it('renvoie zéro quand l’accès est fermé', () => {
    expect(supportAccessMinutesLeft({ expires_at: dans(-1), revoked_at: null }, MAINTENANT)).toBe(0)
    expect(supportAccessMinutesLeft(null, MAINTENANT)).toBe(0)
  })
})

describe('isSupportMember', () => {
  it('reconnaît une adresse de la liste, sans se soucier de la casse', () => {
    expect(isSupportMember('Contact@WashBoard.fr', 'contact@washboard.fr')).toBe(true)
    expect(isSupportMember(' contact@washboard.fr ', 'contact@washboard.fr')).toBe(true)
  })

  it('accepte plusieurs adresses séparées par des virgules', () => {
    const liste = 'a@washboard.fr, b@washboard.fr'
    expect(isSupportMember('b@washboard.fr', liste)).toBe(true)
    expect(isSupportMember('c@washboard.fr', liste)).toBe(false)
  })

  it('ne reconnaît personne si la variable n’est pas définie', () => {
    // Un déploiement mal configuré doit fermer l'accès, pas l'ouvrir à tous.
    expect(isSupportMember('contact@washboard.fr', undefined)).toBe(false)
    expect(isSupportMember('contact@washboard.fr', '')).toBe(false)
  })

  it('refuse une adresse absente ou vide', () => {
    expect(isSupportMember(null, 'contact@washboard.fr')).toBe(false)
    expect(isSupportMember('', 'contact@washboard.fr')).toBe(false)
    expect(isSupportMember('   ', 'contact@washboard.fr')).toBe(false)
  })
})

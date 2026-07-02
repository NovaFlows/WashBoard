import { describe, it, expect } from 'vitest'
import {
  mapStripeStatus,
  stripeCancelToIso,
  isAlreadySubscribed,
  computeTrialEnd,
  isCardRegistered,
  formatDateFR,
} from './subscription'

describe('mapStripeStatus', () => {
  it('mappe les statuts vivants', () => {
    expect(mapStripeStatus('active')).toBe('active')
    expect(mapStripeStatus('trialing')).toBe('trial')
    expect(mapStripeStatus('past_due')).toBe('past_due')
  })
  it('mappe tout le reste vers expired', () => {
    expect(mapStripeStatus('canceled')).toBe('expired')
    expect(mapStripeStatus('unpaid')).toBe('expired')
    expect(mapStripeStatus('incomplete_expired')).toBe('expired')
    expect(mapStripeStatus('paused')).toBe('expired')
    expect(mapStripeStatus('')).toBe('expired')
  })
})

describe('stripeCancelToIso', () => {
  it('convertit un timestamp en ISO', () => {
    // 1784592000 s = 2026-07-21T00:00:00Z
    expect(stripeCancelToIso(1784592000)).toBe('2026-07-21T00:00:00.000Z')
  })
  it('retourne null sans résiliation', () => {
    expect(stripeCancelToIso(null)).toBeNull()
    expect(stripeCancelToIso(undefined)).toBeNull()
    expect(stripeCancelToIso(0)).toBeNull()
  })
})

describe('isAlreadySubscribed', () => {
  it('vrai si abonnement rattaché + statut vivant', () => {
    expect(isAlreadySubscribed({ subscriptionId: 'sub_1', status: 'active' })).toBe(true)
    expect(isAlreadySubscribed({ subscriptionId: 'sub_1', status: 'past_due' })).toBe(true)
    expect(isAlreadySubscribed({ subscriptionId: 'sub_1', status: 'trial' })).toBe(true)
  })
  it('faux sans subscription id (essai sans carte)', () => {
    expect(isAlreadySubscribed({ subscriptionId: null, status: 'trial' })).toBe(false)
    expect(isAlreadySubscribed({ subscriptionId: undefined, status: 'active' })).toBe(false)
  })
  it('faux si expiré même avec un ancien subscription id', () => {
    expect(isAlreadySubscribed({ subscriptionId: 'sub_1', status: 'expired' })).toBe(false)
  })
})

describe('isCardRegistered', () => {
  it('vrai si subscription id + statut trial', () => {
    expect(isCardRegistered('sub_1', 'trial')).toBe(true)
  })
  it('faux sans subscription id', () => {
    expect(isCardRegistered(null, 'trial')).toBe(false)
    expect(isCardRegistered(undefined, 'trial')).toBe(false)
  })
  it('faux si statut non-trial même avec subscription id', () => {
    expect(isCardRegistered('sub_1', 'active')).toBe(false)
    expect(isCardRegistered('sub_1', null)).toBe(false)
  })
})

describe('formatDateFR', () => {
  it('formate une date ISO en français long', () => {
    // 2026-07-21 → "21 juillet 2026"
    expect(formatDateFR('2026-07-21T00:00:00.000Z')).toMatch(/21.*juillet.*2026/)
  })
  it('accepte un objet Date', () => {
    expect(formatDateFR(new Date('2026-01-01T12:00:00Z'))).toMatch(/1.*janvier.*2026/)
  })
})

describe('computeTrialEnd', () => {
  const now = new Date('2026-07-01T00:00:00Z').getTime()

  it('diffère si l’essai finit dans plus de 48h', () => {
    const end = '2026-07-10T00:00:00Z'
    expect(computeTrialEnd('trial', end, now)).toBe(Math.floor(new Date(end).getTime() / 1000))
  })
  it('ne diffère pas si l’essai finit dans moins de 48h', () => {
    expect(computeTrialEnd('trial', '2026-07-02T00:00:00Z', now)).toBeUndefined()
  })
  it('ne diffère pas hors statut trial', () => {
    expect(computeTrialEnd('active', '2026-08-01T00:00:00Z', now)).toBeUndefined()
  })
  it('gère les entrées invalides', () => {
    expect(computeTrialEnd('trial', null, now)).toBeUndefined()
    expect(computeTrialEnd('trial', 'pas-une-date', now)).toBeUndefined()
  })
})

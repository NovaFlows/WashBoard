import { describe, it, expect } from 'vitest'
import { mapStripeStatus, stripeCancelToIso, isAlreadySubscribed, computeTrialEnd, isCardRegistered, formatDateFR, stripePeriodEndToIso } from './subscription'

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

describe('stripePeriodEndToIso', () => {
  // `subscription_ends_at` était lue à six endroits et écrite nulle part : la
  // période de grâce de 30 jours n'existait pas en pratique.
  it('convertit la fin de période en date lisible', () => {
    const t = Math.floor(new Date('2026-10-15T12:00:00Z').getTime() / 1000)
    expect(stripePeriodEndToIso([{ current_period_end: t }])).toBe('2026-10-15T12:00:00.000Z')
  })

  it('retient la fin la plus lointaine quand il y a plusieurs lignes', () => {
    // Tant qu'une ligne est payée, l'abonnement l'est.
    const tot = Math.floor(new Date('2026-10-01T00:00:00Z').getTime() / 1000)
    const tard = Math.floor(new Date('2026-12-01T00:00:00Z').getTime() / 1000)
    expect(stripePeriodEndToIso([{ current_period_end: tot }, { current_period_end: tard }]))
      .toBe('2026-12-01T00:00:00.000Z')
  })

  it('renvoie null plutôt qu’une date fantaisiste quand Stripe ne dit rien', () => {
    // Depuis 2025, `current_period_end` a changé de place : le lire au mauvais
    // endroit rend `undefined` sans erreur. Mieux vaut null qu'une date de 1970,
    // qui ferait croire à une grâce terminée depuis cinquante ans.
    expect(stripePeriodEndToIso([])).toBeNull()
    expect(stripePeriodEndToIso(null)).toBeNull()
    expect(stripePeriodEndToIso(undefined)).toBeNull()
    expect(stripePeriodEndToIso([{ current_period_end: undefined }])).toBeNull()
    expect(stripePeriodEndToIso([{ current_period_end: 0 }])).toBeNull()
  })
})

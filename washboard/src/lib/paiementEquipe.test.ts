import { describe, it, expect } from 'vitest'
import { payeJusquAu, validerPaiement } from './paiementEquipe'

const NOW = new Date('2026-11-20T10:00:00.000Z')

describe('validerPaiement', () => {
  it('offre payante et durée d’un mois ou d’un an seulement', () => {
    expect(validerPaiement({ offre: 'pro', dureeMois: 1 })).toEqual({ offre: 'pro', dureeMois: 1 })
    expect(validerPaiement({ offre: 'business', dureeMois: 12 })).toEqual({ offre: 'business', dureeMois: 12 })
    expect(validerPaiement({ offre: 'decouverte', dureeMois: 1 })).toHaveProperty('erreur')
    expect(validerPaiement({ offre: 'pro', dureeMois: 3 })).toHaveProperty('erreur')
    expect(validerPaiement({ offre: 'pro', dureeMois: '1' })).toHaveProperty('erreur')
    expect(validerPaiement(null)).toHaveProperty('erreur')
  })
})

describe('payeJusquAu', () => {
  it('premier paiement hors essai : à partir d’aujourd’hui', () => {
    expect(payeJusquAu({ subscription_status: 'expired' }, 1, NOW)).toBe('2026-12-20T10:00:00.000Z')
  })
  it('pendant l’essai : le filleul garde ses jours gratuits', () => {
    expect(payeJusquAu({ subscription_status: 'trial', trial_ends_at: '2026-12-01T00:00:00.000Z' }, 1, NOW)).toBe('2027-01-01T00:00:00.000Z')
  })
  it('renouvellement : s’ajoute à la période en cours', () => {
    expect(payeJusquAu({ subscription_status: 'active', subscription_ends_at: '2026-12-05T00:00:00.000Z' }, 12, NOW)).toBe('2027-12-05T00:00:00.000Z')
  })
  it('abonnement déjà échu : repart d’aujourd’hui', () => {
    expect(payeJusquAu({ subscription_status: 'active', subscription_ends_at: '2026-10-05T00:00:00.000Z' }, 1, NOW)).toBe('2026-12-20T10:00:00.000Z')
  })
})

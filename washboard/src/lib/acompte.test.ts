import { describe, it, expect } from 'vitest'
import { ReglagesAcompteSchema, acompteActif, conditionsAcompte, echeanceAcompte, liensDePaiement, montantAcompte } from './acompte'

const base = { actif: true, type: 'pourcentage' as const, valeur: 30, liens: { sumup: 'https://sumup.me/eclat' }, delai_heures: 24, remboursable: true, remboursement_heures: 48 }

describe('montantAcompte', () => {
  it('pourcentage du total, arrondi au centime', () => {
    expect(montantAcompte(base, 119)).toBe(35.7)
    expect(montantAcompte({ type: 'pourcentage', valeur: 33 }, 10)).toBe(3.3)
  })
  it('montant fixe, jamais plus que le total, rien sans total', () => {
    expect(montantAcompte({ type: 'montant', valeur: 30 }, 90)).toBe(30)
    expect(montantAcompte({ type: 'montant', valeur: 30 }, 20)).toBe(20)
    expect(montantAcompte(base, 0)).toBe(0)
  })
})

describe('réglages', () => {
  it('actif seulement si valide et allumé', () => {
    expect(acompteActif(base)).not.toBeNull()
    expect(acompteActif({ ...base, actif: false })).toBeNull()
    expect(acompteActif({ ...base, liens: { stripe: 'http://pas-securise.fr' } })).toBeNull()
    expect(acompteActif(null)).toBeNull()
    expect(acompteActif('n’importe quoi')).toBeNull()
  })
  it('refuse plus de 100 % et un remboursement sans délai', () => {
    expect(ReglagesAcompteSchema.safeParse({ ...base, valeur: 120 }).success).toBe(false)
    expect(ReglagesAcompteSchema.safeParse({ ...base, remboursement_heures: null }).success).toBe(false)
    expect(ReglagesAcompteSchema.safeParse({ ...base, remboursable: false, remboursement_heures: null }).success).toBe(true)
  })
})

describe('échéance et conditions', () => {
  it('échéance après le délai, ou aucune', () => {
    expect(echeanceAcompte({ delai_heures: 24 }, new Date('2027-02-10T10:00:00Z'))).toBe('2027-02-11T10:00:00.000Z')
    expect(echeanceAcompte({ delai_heures: null })).toBeNull()
  })
  it('conditions lisibles par le client', () => {
    expect(conditionsAcompte(base)).toEqual([
      'À régler dans les 24 h après la réservation, sinon elle est annulée.',
      'Remboursé si vous annulez au moins 48 h avant le rendez-vous.',
      'Le reste se règle sur place.',
    ])
    expect(conditionsAcompte({ delai_heures: 2, remboursable: false, remboursement_heures: null })[0]).toBe('À régler dans les 2 h après la réservation, sinon elle est annulée.')
    expect(conditionsAcompte({ delai_heures: null, remboursable: false, remboursement_heures: null })[1]).toBe('Non remboursable en cas d’annulation de votre part.')
  })
})

describe('liens de paiement', () => {
  it('PayPal.me reçoit le montant exact, les autres liens restent tels quels', () => {
    expect(liensDePaiement({ paypal: 'https://paypal.me/eclat/', stripe: 'https://buy.stripe.com/abc', lydia: '' }, 16.05)).toEqual([
      { cle: 'paypal', libelle: 'PayPal', url: 'https://paypal.me/eclat/16.05EUR', montantExact: true },
      { cle: 'stripe', libelle: 'Stripe', url: 'https://buy.stripe.com/abc', montantExact: false },
    ])
  })
  it('un lien PayPal.me qui porte déjà un montant le garde', () => {
    expect(liensDePaiement({ paypal: 'https://paypal.me/eclat/30' }, 16.05)[0]).toMatchObject({ url: 'https://paypal.me/eclat/30', montantExact: false })
  })
  it('refuse un lien PayPal qui n’est pas un PayPal.me, et un acompte actif sans aucun lien', () => {
    expect(ReglagesAcompteSchema.safeParse({ ...base, liens: { paypal: 'https://www.paypal.com/donate/xyz' } }).success).toBe(false)
    expect(ReglagesAcompteSchema.safeParse({ ...base, liens: {} }).success).toBe(false)
    expect(ReglagesAcompteSchema.safeParse({ ...base, actif: false, liens: {} }).success).toBe(true)
  })
  it('reprend l’ancien format à un seul lien', () => {
    const { liens: _l, ...sansLiens } = base
    expect(acompteActif({ ...sansLiens, lien: 'https://buy.stripe.com/test' })?.liens).toEqual({ autre: 'https://buy.stripe.com/test' })
  })
})

import { describe, it, expect } from 'vitest'
import {
  PromotionSaisieSchema, chevauche, couleurTexteSur, libelleRemise, promotionActive, remisePromotion, tempsRestant,
} from './promotion'

const pourcent = { type_remise: 'pourcentage' as const, valeur: 20, service_ids: null }
const montant = { type_remise: 'montant' as const, valeur: 15, service_ids: ['a0000000-0000-4000-8000-000000000001'] }

describe('remisePromotion', () => {
  it('pourcentage sur toutes les prestations, arrondi au centime', () => {
    expect(remisePromotion(pourcent, 'x', 119)).toBe(23.8)
    expect(remisePromotion({ ...pourcent, valeur: 15 }, 'x', 33.33)).toBe(5)
  })
  it('montant fixe, seulement sur les prestations choisies', () => {
    expect(remisePromotion(montant, 'a0000000-0000-4000-8000-000000000001', 90)).toBe(15)
    expect(remisePromotion(montant, 'autre', 90)).toBe(0)
  })
  it('jamais plus que le prix, jamais négative, rien sans prestation', () => {
    expect(remisePromotion({ ...montant, service_ids: null }, 'x', 10)).toBe(10)
    expect(remisePromotion(pourcent, 'x', 0)).toBe(0)
    expect(remisePromotion(pourcent, null, 50)).toBe(0)
    expect(remisePromotion(null, 'x', 50)).toBe(0)
  })
})

describe('période', () => {
  const p = { debut: '2027-02-07T00:00:00+01:00', fin: '2027-02-15T00:00:00+01:00' }
  it('active entre le début et la fin (fin exclue)', () => {
    expect(promotionActive([p], new Date('2027-02-10T12:00:00+01:00'))).toBe(p)
    expect(promotionActive([p], new Date('2027-02-15T00:00:00+01:00'))).toBeNull()
    expect(promotionActive([p], new Date('2027-02-06T23:59:00+01:00'))).toBeNull()
  })
  it('chevauchement', () => {
    expect(chevauche(p, { debut: '2027-02-14T00:00:00+01:00', fin: '2027-02-20T00:00:00+01:00' })).toBe(true)
    expect(chevauche(p, { debut: '2027-02-15T00:00:00+01:00', fin: '2027-02-20T00:00:00+01:00' })).toBe(false)
  })
  it('temps restant', () => {
    expect(tempsRestant('2027-02-15T00:00:00Z', new Date('2027-02-13T22:58:30Z'))).toEqual({ jours: 1, heures: 1, minutes: 1, secondes: 30 })
    expect(tempsRestant('2027-02-15T00:00:00Z', new Date('2027-02-15T00:00:01Z'))).toBeNull()
  })
})

describe('affichage', () => {
  it('libellé de la remise', () => {
    expect(libelleRemise(pourcent)).toBe('−20 %')
    expect(libelleRemise({ type_remise: 'montant', valeur: 7.5 })).toBe('−7,50 €')
  })
  it('texte lisible sur la couleur du bandeau', () => {
    expect(couleurTexteSur('#16161A')).toBe('#FFFFFF')
    expect(couleurTexteSur('#FFE45C')).toBe('#16161A')
    expect(couleurTexteSur('pas une couleur')).toBe('#FFFFFF')
  })
})

describe('saisie', () => {
  const ok = { nom: 'Saint-Valentin', type_remise: 'pourcentage', valeur: 20, debut: '2027-02-07T00:00:00+01:00', fin: '2027-02-15T00:00:00+01:00' }
  it('accepte une promotion correcte', () => expect(PromotionSaisieSchema.safeParse(ok).success).toBe(true))
  it('refuse plus de 90 %, une fin avant le début, une couleur invalide', () => {
    expect(PromotionSaisieSchema.safeParse({ ...ok, valeur: 95 }).success).toBe(false)
    expect(PromotionSaisieSchema.safeParse({ ...ok, fin: ok.debut }).success).toBe(false)
    expect(PromotionSaisieSchema.safeParse({ ...ok, bandeau_couleur: 'red' }).success).toBe(false)
  })
})

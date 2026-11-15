import { describe, it, expect } from 'vitest'
import { appliquerRemiseLaveur, prixAvantRemiseLaveur, remiseALaSaisie } from './remiseLaveur'

const rdv = { status: 'confirmed', booked_price: 99, is_smart_slot: false, smart_discount: 0 }

describe('appliquerRemiseLaveur', () => {
  it('99 € → 79 € : le prix réservé baisse, la remise est gardée', () => {
    const v = appliquerRemiseLaveur(rdv, '79')
    expect(v).toEqual({ ok: true, ancienPrix: 99, nouveauPrix: 79, colonnes: { booked_price: 79, remise_laveur: 20 } })
  })

  it('accepte la virgule et les centimes', () => {
    const v = appliquerRemiseLaveur(rdv, '79,50')
    expect(v.ok && v.colonnes).toEqual({ booked_price: 79.5, remise_laveur: 19.5 })
  })

  it('cumule avec une remise déjà accordée', () => {
    const v = appliquerRemiseLaveur({ ...rdv, booked_price: 79, remise_laveur: 20 }, 70)
    expect(v.ok && v.colonnes).toEqual({ booked_price: 70, remise_laveur: 29 })
  })

  it('part du montant dû après la remise « créneau optimisé », sans la retrancher deux fois', () => {
    const v = appliquerRemiseLaveur({ ...rdv, is_smart_slot: true, smart_discount: 10 }, 80)
    // dû : 89 ; remise 9 ; booked_price 99 − 9 = 90 ; dû ensuite 90 − 10 = 80
    expect(v.ok && v.colonnes).toEqual({ booked_price: 90, remise_laveur: 9 })
  })

  it('refuse une hausse ou un prix identique', () => {
    expect(appliquerRemiseLaveur(rdv, 99)).toMatchObject({ ok: false, statut: 400 })
    expect(appliquerRemiseLaveur(rdv, 120)).toMatchObject({ ok: false, statut: 400 })
  })

  it('refuse un prix illisible ou négatif', () => {
    expect(appliquerRemiseLaveur(rdv, 'abc')).toMatchObject({ ok: false, statut: 400 })
    expect(appliquerRemiseLaveur(rdv, -5)).toMatchObject({ ok: false, statut: 400 })
  })

  it('refuse une fois la facture émise', () => {
    expect(appliquerRemiseLaveur({ ...rdv, status: 'done', facture_numero: 'F-2026-0001' }, 79)).toMatchObject({ ok: false, statut: 409 })
  })

  it('accepte un rendez-vous terminé sans facture', () => {
    expect(appliquerRemiseLaveur({ ...rdv, status: 'done', facture_numero: null }, 79).ok).toBe(true)
  })

  it('refuse un rendez-vous annulé', () => {
    expect(appliquerRemiseLaveur({ ...rdv, status: 'cancelled' }, 79)).toMatchObject({ ok: false, statut: 409 })
  })

  it('refuse de descendre sous l’acompte demandé ou reçu', () => {
    expect(appliquerRemiseLaveur({ ...rdv, acompte_montant: 30, acompte_statut: 'recu' }, 25)).toMatchObject({ ok: false, statut: 409 })
    expect(appliquerRemiseLaveur({ ...rdv, acompte_montant: 30, acompte_statut: 'en_attente' }, 25)).toMatchObject({ ok: false, statut: 409 })
    expect(appliquerRemiseLaveur({ ...rdv, acompte_montant: 30, acompte_statut: 'recu' }, 30).ok).toBe(true)
  })

  it('ignore un montant d’acompte sans acompte demandé', () => {
    expect(appliquerRemiseLaveur({ ...rdv, acompte_montant: 30, acompte_statut: null }, 10).ok).toBe(true)
  })

  it('retombe sur le prix catalogue quand booked_price manque', () => {
    const v = appliquerRemiseLaveur({ status: 'pending', booked_price: null, services: { price: 50 } }, 40)
    expect(v.ok && v.colonnes).toEqual({ booked_price: 40, remise_laveur: 10 })
  })
})

describe('prixAvantRemiseLaveur', () => {
  it('rajoute la remise du laveur au montant dû', () => {
    expect(prixAvantRemiseLaveur({ status: 'done', booked_price: 79, remise_laveur: 20 })).toBe(99)
    expect(prixAvantRemiseLaveur({ status: 'done', booked_price: 79 })).toBe(79)
  })
})

describe('remiseALaSaisie', () => {
  it('un prix tapé plus bas devient une remise', () => {
    expect(remiseALaSaisie(99, 79)).toBe(20)
    expect(remiseALaSaisie(99, '79,5')).toBe(19.5)
  })

  it('plus haut, égal, illisible ou absent : aucune remise', () => {
    expect(remiseALaSaisie(99, 120)).toBe(0)
    expect(remiseALaSaisie(99, 99)).toBe(0)
    expect(remiseALaSaisie(99, 'abc')).toBe(0)
    expect(remiseALaSaisie(99, undefined)).toBe(0)
  })
})

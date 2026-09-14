import { describe, it, expect } from 'vitest'
import { estReservable, champsManquants, messageManques } from './prestation'

const complete = { name: 'Lavage complet', price: '80', duration_minutes: '90', vehicle_types: ['SUV'] }

describe('estReservable', () => {
  it('vrai avec au moins un type', () => {
    expect(estReservable({ vehicle_types: ['citadine'] })).toBe(true)
  })

  it('faux sans type : le client resterait bloqué sur la page de réservation', () => {
    expect(estReservable({ vehicle_types: [] })).toBe(false)
  })

  it('faux si la donnée est absente ou mal formée (charge venue du navigateur)', () => {
    expect(estReservable({})).toBe(false)
    expect(estReservable({ vehicle_types: null })).toBe(false)
    expect(estReservable({ vehicle_types: 'SUV' })).toBe(false)
  })
})

describe('champsManquants', () => {
  it('rien ne manque sur une prestation complète', () => {
    expect(champsManquants(complete)).toEqual([])
  })

  it('un prix à 0 € est un prix, pas un oubli', () => {
    expect(champsManquants({ ...complete, price: '0' })).toEqual([])
  })

  it('signale l’absence de type, le cas qui passait sans avertissement', () => {
    expect(champsManquants({ ...complete, vehicle_types: [] })).toEqual(['type'])
  })

  it('liste tout ce qui manque, dans l’ordre du formulaire', () => {
    expect(champsManquants({ name: '  ', price: '', duration_minutes: '', vehicle_types: [] }))
      .toEqual(['nom', 'prix', 'duree', 'type'])
  })

  it('une durée nulle compte comme manquante', () => {
    expect(champsManquants({ ...complete, duration_minutes: '0' })).toEqual(['duree'])
  })
})

describe('messageManques', () => {
  it('aucun message quand tout est rempli', () => {
    expect(messageManques([])).toBeNull()
  })

  it('un seul manque', () => {
    expect(messageManques(['type'])).toBe('Pour enregistrer, il manque au moins un type.')
  })

  it('plusieurs manques, reliés par « et »', () => {
    expect(messageManques(['nom', 'prix', 'type']))
      .toBe('Pour enregistrer, il manque le nom, le prix et au moins un type.')
  })
})

import { describe, it, expect } from 'vitest'
import {
  estReservable, champsManquants, messageManques, dureeValide, DUREE_MAX_MINUTES,
  estRefusCleEtrangere, CODE_PG_CLE_ETRANGERE, ERREUR_PRESTATION_RESERVEE, ERREUR_SANS_TYPE,
} from './prestation'

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

  it('une durée déraisonnable (5000 min, incident réel) est signalée, pas juste acceptée', () => {
    expect(champsManquants({ ...complete, duration_minutes: '5000' })).toEqual(['duree_max'])
  })

  it('la durée maximale exacte reste acceptée', () => {
    expect(champsManquants({ ...complete, duration_minutes: String(DUREE_MAX_MINUTES) })).toEqual([])
  })
})

describe('dureeValide', () => {
  it('accepte une durée normale', () => {
    expect(dureeValide(90)).toBe(true)
  })

  it('refuse zéro, le négatif et le non fini', () => {
    expect(dureeValide(0)).toBe(false)
    expect(dureeValide(-10)).toBe(false)
    expect(dureeValide(NaN)).toBe(false)
  })

  it('accepte le plafond, refuse juste au-dessus', () => {
    expect(dureeValide(DUREE_MAX_MINUTES)).toBe(true)
    expect(dureeValide(DUREE_MAX_MINUTES + 1)).toBe(false)
  })

  it('refuse 5000 minutes, la valeur enregistrée en vrai avant ce correctif', () => {
    expect(dureeValide(5000)).toBe(false)
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

  it('« duree_max » seul ne produit aucun message : ce champ n’est pas manquant, il est trop grand — son message vit ailleurs (ERREUR_DUREE_MAX), pas dans « il manque »', () => {
    expect(messageManques(['duree_max'])).toBeNull()
  })

  it('« duree_max » est ignoré au milieu d’une vraie liste de manques', () => {
    expect(messageManques(['nom', 'duree_max'])).toBe('Pour enregistrer, il manque le nom.')
  })
})

describe('estRefusCleEtrangere', () => {
  it('reconnaît le refus Postgres 23503 renvoyé par Supabase', () => {
    expect(estRefusCleEtrangere({ code: CODE_PG_CLE_ETRANGERE, message: 'update or delete on table "services" violates foreign key constraint' })).toBe(true)
  })

  it('ne confond pas avec une autre erreur de base', () => {
    expect(estRefusCleEtrangere({ code: '23505' })).toBe(false)
    expect(estRefusCleEtrangere({ code: 'PGRST116' })).toBe(false)
  })

  it('tolère tout ce qui n’est pas un objet d’erreur', () => {
    expect(estRefusCleEtrangere(null)).toBe(false)
    expect(estRefusCleEtrangere(undefined)).toBe(false)
    expect(estRefusCleEtrangere('23503')).toBe(false)
    expect(estRefusCleEtrangere({})).toBe(false)
  })
})

describe('messages de refus', () => {
  it('le refus « réservée » ne conseille pas de retirer les types : une prestation sans type est refusée', () => {
    expect(ERREUR_PRESTATION_RESERVEE).not.toMatch(/retirez/i)
    expect(ERREUR_SANS_TYPE).toMatch(/au moins un type/)
  })
})

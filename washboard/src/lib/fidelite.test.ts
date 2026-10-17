import { describe, it, expect } from 'vitest'
import { ReglagesFideliteSchema, etatCarte, fideliteActive, jetonValide, libelleRecompense, nouveauJeton, phraseCarte, remiseFidelite } from './fidelite'

const fait = (n: number) => Array.from({ length: n }, () => ({ status: 'done' }))

describe('etatCarte', () => {
  it('compte les prestations terminées, pas les annulées ni celles en attente', () => {
    const e = etatCarte([...fait(7), { status: 'cancelled' }, { status: 'pending' }], 0, 10)
    expect(e).toEqual({ total: 7, progression: 7, requis: 10, disponibles: 0 })
  })
  it('une récompense par carte pleine, moins celles déjà utilisées', () => {
    expect(etatCarte(fait(10), 0, 10).disponibles).toBe(1)
    expect(etatCarte([...fait(10), { status: 'pending', fidelite_remise: 45 }], 0, 10).disponibles).toBe(0)
    expect(etatCarte(fait(23), 0, 10)).toMatchObject({ progression: 3, disponibles: 2 })
  })
  it('annuler la réservation qui utilisait la récompense la rend', () => {
    expect(etatCarte([...fait(10), { status: 'cancelled', fidelite_remise: 45 }], 0, 10).disponibles).toBe(1)
  })
  it('l’ajustement du laveur ajoute ou retire des tampons, jamais sous zéro', () => {
    expect(etatCarte(fait(3), 2, 10).total).toBe(5)
    expect(etatCarte(fait(1), -5, 10).total).toBe(0)
  })
})

describe('récompense', () => {
  it('offerte, en %, en €, jamais plus que le prix', () => {
    expect(remiseFidelite({ recompense: 'offerte', valeur: 0 }, 59)).toBe(59)
    expect(remiseFidelite({ recompense: 'pourcentage', valeur: 20 }, 59)).toBe(11.8)
    expect(remiseFidelite({ recompense: 'montant', valeur: 80 }, 59)).toBe(59)
    expect(remiseFidelite({ recompense: 'montant', valeur: 10 }, 0)).toBe(0)
  })
  it('phrases lisibles par le client', () => {
    expect(libelleRecompense({ recompense: 'pourcentage', valeur: 20 })).toBe('−20 % sur une prestation')
    expect(phraseCarte({ total: 7, progression: 7, requis: 10, disponibles: 0 }, { recompense: 'offerte', valeur: 0 })).toBe('Plus que 3 prestations avant une prestation offerte.')
    expect(phraseCarte({ total: 9, progression: 9, requis: 10, disponibles: 0 }, { recompense: 'offerte', valeur: 0 })).toBe('Plus que 1 prestation avant une prestation offerte.')
    expect(phraseCarte({ total: 10, progression: 0, requis: 10, disponibles: 1 }, { recompense: 'montant', valeur: 15 })).toMatch(/^Récompense débloquée : −15 € sur une prestation/)
  })
})

describe('réglages et jeton', () => {
  it('valide les réglages', () => {
    expect(fideliteActive({ actif: true, tampons: 10, recompense: 'offerte', valeur: 0 })).not.toBeNull()
    expect(fideliteActive({ actif: false, tampons: 10, recompense: 'offerte', valeur: 0 })).toBeNull()
    expect(ReglagesFideliteSchema.safeParse({ actif: true, tampons: 1, recompense: 'offerte', valeur: 0 }).success).toBe(false)
    expect(ReglagesFideliteSchema.safeParse({ actif: true, tampons: 10, recompense: 'pourcentage', valeur: 0 }).success).toBe(false)
    expect(fideliteActive('n’importe quoi')).toBeNull()
  })
  it('jeton imprévisible et vérifiable', () => {
    const j = nouveauJeton()
    expect(jetonValide(j)).toBe(true)
    expect(j).not.toBe(nouveauJeton())
    expect(jetonValide('abc')).toBe(false)
  })
})

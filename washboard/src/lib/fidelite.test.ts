import { describe, it, expect } from 'vitest'
import { ReglagesFideliteSchema, etatCarte, fideliteActive, jetonValide, libelleRecompense, nouveauJeton, partiesOffertes, phraseCarte, remiseFidelite } from './fidelite'

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
  const prix = { prestation: 45, options: 14, deplacement: 10 }
  it('offerte : la prestation, plus options et déplacement selon le laveur', () => {
    expect(remiseFidelite({ recompense: 'offerte', valeur: 0, offre_options: true, offre_deplacement: false }, prix)).toBe(59)
    expect(remiseFidelite({ recompense: 'offerte', valeur: 0, offre_options: false, offre_deplacement: false }, prix)).toBe(45)
    expect(remiseFidelite({ recompense: 'offerte', valeur: 0, offre_options: true, offre_deplacement: true }, prix)).toBe(69)
  })
  it('remise en % ou en € : sur prestation et options, jamais le déplacement, jamais plus', () => {
    expect(remiseFidelite({ recompense: 'pourcentage', valeur: 20 }, prix)).toBe(11.8)
    expect(remiseFidelite({ recompense: 'montant', valeur: 80 }, prix)).toBe(59)
    expect(remiseFidelite({ recompense: 'montant', valeur: 10 }, { prestation: 0, options: 0, deplacement: 10 })).toBe(0)
  })
  it('dit ce qui est offert', () => {
    expect(partiesOffertes({ offre_options: true, offre_deplacement: true })).toBe('la prestation, les options et le déplacement')
    expect(partiesOffertes({ offre_options: false })).toBe('la prestation')
    expect(libelleRecompense({ recompense: 'offerte', valeur: 0, offre_options: true, offre_deplacement: true })).toBe('une prestation offerte (options et déplacement compris)')
  })
  it('phrases lisibles par le client', () => {
    expect(libelleRecompense({ recompense: 'pourcentage', valeur: 20 })).toBe('−20 % sur une prestation')
    expect(phraseCarte({ total: 7, progression: 7, requis: 10, disponibles: 0 }, { recompense: 'offerte', valeur: 0, offre_options: false })).toBe('Plus que 3 prestations avant une prestation offerte.')
    expect(phraseCarte({ total: 9, progression: 9, requis: 10, disponibles: 0 }, { recompense: 'offerte', valeur: 0, offre_options: false })).toBe('Plus que 1 prestation avant une prestation offerte.')
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

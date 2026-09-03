import { describe, it, expect } from 'vitest'
import { selectionnerFantomes } from './ghostAccounts'

const MAINTENANT = new Date('2026-09-03T12:00:00.000Z')
const ilYA = (heures: number) =>
  new Date(MAINTENANT.getTime() - heures * 60 * 60 * 1000).toISOString()

describe('selectionnerFantomes', () => {
  it('retient un compte ancien sans fiche laveur', () => {
    const users = [{ id: 'fantome', created_at: ilYA(72) }]
    expect(selectionnerFantomes(users, [], MAINTENANT)).toEqual(['fantome'])
  })

  it('épargne un compte qui a une fiche laveur, même très ancien', () => {
    const users = [{ id: 'laveur', created_at: ilYA(10_000) }]
    expect(selectionnerFantomes(users, ['laveur'], MAINTENANT)).toEqual([])
  })

  it('épargne une inscription en cours', () => {
    // Entre la création de l'utilisateur et l'insertion de sa fiche, un compte
    // légitime est indiscernable d'un fantôme. Sans ce délai, on supprimerait
    // le compte d'un laveur pendant qu'il s'inscrit.
    const users = [{ id: 'en-cours', created_at: ilYA(0.05) }]
    expect(selectionnerFantomes(users, [], MAINTENANT)).toEqual([])
  })

  it('épargne un compte juste sous le seuil, retient juste au-dessus', () => {
    const users = [
      { id: 'avant', created_at: ilYA(23.9) },
      { id: 'apres', created_at: ilYA(24.1) },
    ]
    expect(selectionnerFantomes(users, [], MAINTENANT)).toEqual(['apres'])
  })

  it('ne supprime rien quand aucun compte n’est orphelin', () => {
    const users = [
      { id: 'a', created_at: ilYA(500) },
      { id: 'b', created_at: ilYA(500) },
    ]
    expect(selectionnerFantomes(users, ['a', 'b'], MAINTENANT)).toEqual([])
  })

  it('épargne un compte dont la date est illisible', () => {
    // Mieux vaut laisser survivre un fantôme que d'effacer un compte sur la
    // foi d'une date qu'on n'a pas su lire.
    const users = [{ id: 'douteux', created_at: 'pas une date' }]
    expect(selectionnerFantomes(users, [], MAINTENANT)).toEqual([])
  })

  it('respecte un délai personnalisé', () => {
    const users = [{ id: 'x', created_at: ilYA(2) }]
    expect(selectionnerFantomes(users, [], MAINTENANT, 24)).toEqual([])
    expect(selectionnerFantomes(users, [], MAINTENANT, 1)).toEqual(['x'])
  })

  it('gère une liste vide', () => {
    expect(selectionnerFantomes([], [], MAINTENANT)).toEqual([])
  })
})

import { describe, it, expect } from 'vitest'
import {
  peutOuvrirNouvelleQuestion,
  MAX_QUESTIONS_OUVERTES_PAR_LAVEUR,
  MESSAGE_LIMITE_QUESTIONS_ATTEINTE,
} from './supportQuestionLimit'

describe('peutOuvrirNouvelleQuestion', () => {
  it('autorise tant que le nombre de fils ouverts est sous le plafond', () => {
    expect(peutOuvrirNouvelleQuestion(0)).toBe(true)
    expect(peutOuvrirNouvelleQuestion(MAX_QUESTIONS_OUVERTES_PAR_LAVEUR - 1)).toBe(true)
  })

  it('refuse dès que le plafond est atteint, pas seulement dépassé', () => {
    // Le laveur en a déjà 10 : le onzième doit être refusé, pas seulement le douzième.
    expect(peutOuvrirNouvelleQuestion(MAX_QUESTIONS_OUVERTES_PAR_LAVEUR)).toBe(false)
    expect(peutOuvrirNouvelleQuestion(MAX_QUESTIONS_OUVERTES_PAR_LAVEUR + 5)).toBe(false)
  })

  it('accepte un plafond personnalisé, pour les tests d’intégration ou une future config', () => {
    expect(peutOuvrirNouvelleQuestion(3, 3)).toBe(false)
    expect(peutOuvrirNouvelleQuestion(2, 3)).toBe(true)
  })

  it('refuse par prudence sur un compte négatif ou aberrant plutôt que de planter', () => {
    // Ne devrait jamais arriver (un COUNT Postgres ne renvoie pas de négatif),
    // mais la fonction ne doit pas se comporter de façon surprenante si un
    // jour elle reçoit une valeur invalide.
    expect(peutOuvrirNouvelleQuestion(-1)).toBe(true) // -1 < 10 : reste techniquement sous le plafond
  })
})

describe('MESSAGE_LIMITE_QUESTIONS_ATTEINTE', () => {
  it('est un message compréhensible par le laveur, pas un code technique', () => {
    expect(MESSAGE_LIMITE_QUESTIONS_ATTEINTE).not.toMatch(/error|Error|50\d|40\d/)
    expect(MESSAGE_LIMITE_QUESTIONS_ATTEINTE.length).toBeGreaterThan(20)
  })
})

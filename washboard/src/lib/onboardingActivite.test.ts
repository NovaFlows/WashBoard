import { describe, it, expect } from 'vitest'
import { QUESTIONS_ACTIVITE, nettoyerProfilActivite } from './onboarding'

describe('questions sur l’activité', () => {
  it('chaque question a une clé unique et des valeurs uniques', () => {
    const cles = QUESTIONS_ACTIVITE.map(q => q.cle)
    expect(new Set(cles).size).toBe(cles.length)
    for (const q of QUESTIONS_ACTIVITE) {
      const valeurs = q.choix.map(x => x.valeur)
      expect(new Set(valeurs).size, q.cle).toBe(valeurs.length)
      expect(valeurs.length, q.cle).toBeGreaterThanOrEqual(2)
    }
  })

  it('garde les réponses connues, simples et multiples', () => {
    expect(nettoyerProfilActivite({ ca_mois: '1000_3000', prise_rdv: ['telephone', 'reseaux', 'telephone'] }))
      .toEqual({ ca_mois: '1000_3000', prise_rdv: ['telephone', 'reseaux'] })
  })

  it('ignore les clés inconnues, les valeurs hors liste et les mauvais types', () => {
    expect(nettoyerProfilActivite({
      inconnue: 'x', ca_mois: '999999', equipe: ['1'], prise_rdv: 'telephone', temps_perdu: ['factures', 'pirate', 3],
    })).toEqual({ temps_perdu: ['factures'] })
  })

  it('ne renvoie rien pour une entrée vide ou invalide', () => {
    for (const v of [null, undefined, 'texte', 42, [], {}]) expect(nettoyerProfilActivite(v)).toEqual({})
  })
})

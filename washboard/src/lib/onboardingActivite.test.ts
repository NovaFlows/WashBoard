import { describe, it, expect } from 'vitest'
import { QUESTIONS_ACTIVITE, QUESTIONS_FACULTATIVES, QUESTIONS_OBLIGATOIRES, nettoyerProfilActivite, questionsObligatoiresRepondues, type ProfilActivite } from './onboarding'

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

describe('questionsObligatoiresRepondues', () => {
  it('statut, temps perdu et panier moyen sont facultatifs', () => {
    expect(QUESTIONS_FACULTATIVES.map(q => q.cle).sort()).toEqual(['panier_moyen', 'statut', 'temps_perdu'])
  })

  it('exige une réponse à chaque question obligatoire', () => {
    const complet: ProfilActivite = Object.fromEntries(
      QUESTIONS_OBLIGATOIRES.map(q => [q.cle, q.multiple ? [q.choix[0].valeur] : q.choix[0].valeur]),
    )
    expect(questionsObligatoiresRepondues(complet)).toBe(true)
    const multiple = QUESTIONS_OBLIGATOIRES.find(q => q.multiple)!
    expect(questionsObligatoiresRepondues({ ...complet, [multiple.cle]: [] })).toBe(false)
    const { [QUESTIONS_OBLIGATOIRES[0].cle]: _retiree, ...incomplet } = complet
    expect(questionsObligatoiresRepondues(incomplet)).toBe(false)
  })
})

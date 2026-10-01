import { describe, it, expect } from 'vitest'
import {
  exempleRemise, formulaireDepuisReglages, lireNombre, lireProximite, phraseProche,
  prestationExemple, prixLePlusBas, resumeCreneaux, validerCreneaux,
  CRENEAUX_ETEINTS, ERREUR_POURCENT_MAX, ERREUR_PROXIMITE, ERREUR_REMISE_NEGATIVE, ERREUR_REMISE_VIDE,
  FENETRE_MINUTES, POURCENT_MAX, PROXIMITE_MAX,
  type FormulaireCreneaux,
} from './creneauxForm'

const form = (p: Partial<FormulaireCreneaux> = {}): FormulaireCreneaux => ({
  actif: true, proximite: '15', type: 'fixed', valeur: '5', ...p,
})

describe('lireNombre', () => {
  it('accepte la virgule décimale', () => {
    expect(lireNombre('7,5')).toBe(7.5)
    expect(lireNombre(' 10 ')).toBe(10)
    expect(lireNombre('0')).toBe(0)
  })

  it('refuse le vide et le texte', () => {
    for (const saisie of ['', '   ', 'cinq', '5 €', '1.2.3']) expect(lireNombre(saisie)).toBeNull()
  })

  it('lit un nombre négatif plutôt que de l’ignorer (c’est la validation qui refuse)', () => {
    expect(lireNombre('-3')).toBe(-3)
  })
})

describe('lireProximite', () => {
  it('accepte un entier dans les bornes du serveur', () => {
    expect(lireProximite('5')).toBe(5)
    expect(lireProximite('60')).toBe(PROXIMITE_MAX)
  })

  it('refuse hors bornes ou non entier', () => {
    for (const saisie of ['4', '61', '', '12,5', 'abc']) expect(lireProximite(saisie)).toBeNull()
  })
})

describe('phraseProche', () => {
  it('dit les deux conditions du serveur : distance ET fenêtre de 1 h 30', () => {
    expect(FENETRE_MINUTES).toBe(90)
    const p = phraseProche(15)
    expect(p).toContain('moins de 15 min de voiture')
    expect(p).toContain('même jour')
    expect(p).toContain('heure et demie')
  })
})

describe('exempleRemise', () => {
  const lavage = { nom: 'Lavage complet', prix: 80 }

  it('remise en euros', () => {
    expect(exempleRemise(lavage, 'fixed', '5')).toBe(
      'Sur « Lavage complet » à 80 €, votre client paie 75 € : vous encaissez 5 € de moins.',
    )
  })

  it('remise en pourcentage, calculée par smartPrice', () => {
    expect(exempleRemise(lavage, 'percent', '10')).toBe(
      'Sur « Lavage complet » à 80 €, votre client paie 72 € : vous encaissez 8 € de moins.',
    )
  })

  it('une remise à 0 met seulement le créneau en avant', () => {
    expect(exempleRemise(lavage, 'fixed', '0')).toBe(
      'Sur « Lavage complet » à 80 €, le prix ne change pas : le créneau est seulement mis en avant (★).',
    )
  })

  it('sans prestation, un exemple générique à 80 €', () => {
    expect(exempleRemise(null, 'fixed', '5')).toBe(
      'Exemple : un lavage à 80 €, votre client paie 75 € : vous encaissez 5 € de moins.',
    )
  })

  it('une remise plus grande que le prix ne descend jamais sous 0 €', () => {
    expect(exempleRemise(lavage, 'fixed', '200')).toContain('paie 0 €')
  })

  it('rien à montrer tant que la saisie n’est pas un nombre positif', () => {
    expect(exempleRemise(lavage, 'fixed', '')).toBeNull()
    expect(exempleRemise(lavage, 'fixed', '-2')).toBeNull()
  })
})

describe('prestationExemple et prixLePlusBas', () => {
  const liste = [{ nom: 'Devis tapis', prix: 0 }, { nom: 'Lavage complet', prix: 80 }, { nom: 'Express', prix: 25 }]

  it('ignore les prestations « sur devis » à 0 €', () => {
    expect(prestationExemple(liste)).toEqual({ nom: 'Lavage complet', prix: 80 })
    expect(prixLePlusBas(liste)).toBe(25)
  })

  it('rien quand il n’y a aucun prix réel', () => {
    expect(prestationExemple([{ nom: 'Devis', prix: 0 }])).toBeNull()
    expect(prixLePlusBas([])).toBeNull()
  })
})

describe('validerCreneaux', () => {
  it('éteindre n’envoie que l’interrupteur, même avec une valeur invalide', () => {
    expect(validerCreneaux(form({ actif: false, valeur: 'n’importe quoi' }), 30)).toEqual({
      ok: true, champs: { smart_slot_enabled: false },
    })
  })

  it('les quatre champs partent ensemble', () => {
    expect(validerCreneaux(form({ proximite: '20', type: 'percent', valeur: '10' }), 30)).toEqual({
      ok: true,
      champs: {
        smart_slot_enabled: true,
        smart_slot_radius_minutes: 20,
        smart_slot_discount_type: 'percent',
        smart_slot_discount_value: 10,
      },
    })
  })

  it('0 est une valeur légitime : le créneau est seulement mis en avant', () => {
    const r = validerCreneaux(form({ valeur: '0' }), 30)
    expect(r.ok && r.champs.smart_slot_discount_value).toBe(0)
  })

  it('refuse une proximité hors bornes', () => {
    expect(validerCreneaux(form({ proximite: '90' }), 30)).toEqual({
      ok: false, champ: 'proximite', message: ERREUR_PROXIMITE,
    })
  })

  it('refuse une remise vide ou négative', () => {
    expect(validerCreneaux(form({ valeur: '' }), 30)).toEqual({ ok: false, champ: 'valeur', message: ERREUR_REMISE_VIDE })
    expect(validerCreneaux(form({ valeur: '-1' }), 30)).toEqual({ ok: false, champ: 'valeur', message: ERREUR_REMISE_NEGATIVE })
  })

  it('refuse un pourcentage au-delà de 50 — le serveur, lui, accepte tout', () => {
    expect(validerCreneaux(form({ type: 'percent', valeur: String(POURCENT_MAX + 1) }), 30)).toEqual({
      ok: false, champ: 'valeur', message: ERREUR_POURCENT_MAX,
    })
    expect(validerCreneaux(form({ type: 'percent', valeur: String(POURCENT_MAX) }), 30).ok).toBe(true)
  })

  it('refuse une remise en euros au-dessus de la prestation la moins chère', () => {
    const r = validerCreneaux(form({ valeur: '40' }), 30)
    expect(r.ok).toBe(false)
    expect(!r.ok && r.champ).toBe('valeur')
    expect(!r.ok && r.message).toContain('30 €')
  })

  it('sans prix connu, rien à plafonner en euros', () => {
    expect(validerCreneaux(form({ valeur: '40' }), null).ok).toBe(true)
  })

  it('accepte une virgule décimale', () => {
    const r = validerCreneaux(form({ valeur: '7,5' }), 30)
    expect(r.ok && r.champs.smart_slot_discount_value).toBe(7.5)
  })
})

describe('resumeCreneaux', () => {
  it('éteint', () => {
    expect(resumeCreneaux({ actif: false, proximite: 15, type: 'fixed', valeur: 5 })).toBe(CRENEAUX_ETEINTS)
  })

  it('allumé, en euros et en pourcentage', () => {
    expect(resumeCreneaux({ actif: true, proximite: 15, type: 'fixed', valeur: 5 }))
      .toBe('−5 € sur les créneaux à moins de 15 min d’un rendez-vous')
    expect(resumeCreneaux({ actif: true, proximite: 20, type: 'percent', valeur: 10 }))
      .toBe('−10 % sur les créneaux à moins de 20 min d’un rendez-vous')
  })

  it('allumé sans remise : mise en avant seule', () => {
    expect(resumeCreneaux({ actif: true, proximite: 15, type: 'fixed', valeur: 0 }))
      .toBe('Créneaux à moins de 15 min d’un rendez-vous mis en avant, sans remise')
  })
})

describe('formulaireDepuisReglages', () => {
  it('rend les nombres en saisie, sans décimale inutile', () => {
    expect(formulaireDepuisReglages({ actif: true, proximite: 15, type: 'percent', valeur: 10 })).toEqual({
      actif: true, proximite: '15', type: 'percent', valeur: '10',
    })
  })
})

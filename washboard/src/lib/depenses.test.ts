import { describe, expect, it } from 'vitest'
import {
  jourCourt, libelleCategorie, libelleJourDuMois, montantNombre, totalDepenses,
  validerDepense, validerRecurrent,
} from './depenses'

describe('affichage', () => {
  it('traduit une catégorie, garde une valeur inconnue telle quelle', () => {
    expect(libelleCategorie('carburant')).toBe('Carburant')
    expect(libelleCategorie('vieille-categorie')).toBe('vieille-categorie')
  })

  it('additionne les montants, même donnés en texte', () => {
    expect(totalDepenses([{ amount: 12.5 }, { amount: '7.5' }, { amount: 'x' }])).toBe(20)
    expect(totalDepenses([])).toBe(0)
  })

  it('écrit la date en court, sans reculer d’un jour', () => {
    expect(jourCourt('2026-09-12')).toBe('12 sept.')
    expect(jourCourt('2026-01-01')).toBe('1 janv.')
  })

  it('dit le jour du mois d’un frais récurrent', () => {
    expect(libelleJourDuMois(1)).toBe('le 1er de chaque mois')
    expect(libelleJourDuMois(15)).toBe('le 15 de chaque mois')
  })
})

describe('vérifications de saisie', () => {
  const bon = { label: 'Plein essence', amount: '48,90', date: '2026-09-12' }

  it('accepte un frais correct, virgule comprise', () => {
    expect(validerDepense(bon)).toBeNull()
    expect(montantNombre('48,90')).toBe(48.9)
  })

  it('refuse un libellé vide, un montant nul ou négatif, une date absente', () => {
    expect(validerDepense({ ...bon, label: '  ' })).toContain('libellé')
    expect(validerDepense({ ...bon, amount: '0' })).toContain('supérieur à zéro')
    expect(validerDepense({ ...bon, amount: '-5' })).toContain('supérieur à zéro')
    expect(validerDepense({ ...bon, amount: 'abc' })).toContain('supérieur à zéro')
    expect(validerDepense({ ...bon, date: '' })).toContain('date')
  })

  it('borne le jour d’un frais récurrent à 28', () => {
    expect(validerRecurrent({ label: 'Assurance', amount: '30', day_of_month: '5' })).toBeNull()
    expect(validerRecurrent({ label: 'Assurance', amount: '30', day_of_month: '29' })).toContain('1 et 28')
    expect(validerRecurrent({ label: 'Assurance', amount: '30', day_of_month: '0' })).toContain('1 et 28')
    expect(validerRecurrent({ label: '', amount: '30', day_of_month: '5' })).toContain('libellé')
  })
})

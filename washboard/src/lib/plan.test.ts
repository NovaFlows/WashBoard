import { describe, it, expect } from 'vitest'
import {
  hasFeature, washerPlan, requiredPlanLabel,
  yearlyPrice, yearlyMonthlyEquivalent, formatEuros,
  graceEnded, monthsOwed,
} from './plan'

describe('washerPlan', () => {
  it('renvoie le plan valide', () => {
    expect(washerPlan({ plan: 'pro' })).toBe('pro')
    expect(washerPlan({ plan: 'essentiel' })).toBe('essentiel')
  })
  it('retombe sur essentiel pour un plan supprimé', () => {
    expect(washerPlan({ plan: 'business' })).toBe('essentiel')
  })
  it('retombe sur essentiel si plan absent ou invalide', () => {
    expect(washerPlan(null)).toBe('essentiel')
    expect(washerPlan({})).toBe('essentiel')
    expect(washerPlan({ plan: 'n_importe_quoi' })).toBe('essentiel')
  })
})

describe('hasFeature — plan essentiel', () => {
  const w = { plan: 'essentiel', grandfathered: false }
  it('autorise les avis email', () => expect(hasFeature(w, 'avis_email')).toBe(true))
  it('bloque la compta', () => expect(hasFeature(w, 'compta')).toBe(false))
  it('bloque les avis SMS', () => expect(hasFeature(w, 'avis_sms')).toBe(false))
  it('bloque le multi-laveurs', () => expect(hasFeature(w, 'multi_laveurs')).toBe(false))
})

describe('hasFeature — plan pro', () => {
  const w = { plan: 'pro', grandfathered: false }
  it('autorise tout', () => {
    expect(hasFeature(w, 'compta')).toBe(true)
    expect(hasFeature(w, 'avis_sms')).toBe(true)
    expect(hasFeature(w, 'multi_laveurs')).toBe(true)
  })
})

describe('hasFeature — grandfathered', () => {
  it('débloque tout, même sur le plan essentiel', () => {
    const w = { plan: 'essentiel', grandfathered: true }
    expect(hasFeature(w, 'compta')).toBe(true)
    expect(hasFeature(w, 'avis_sms')).toBe(true)
    expect(hasFeature(w, 'multi_laveurs')).toBe(true)
  })
})

describe('requiredPlanLabel', () => {
  it('renvoie le bon plan minimum requis', () => {
    expect(requiredPlanLabel('avis_email')).toBe('Essentiel')
    expect(requiredPlanLabel('compta')).toBe('Pro')
    expect(requiredPlanLabel('avis_sms')).toBe('Pro')
    expect(requiredPlanLabel('multi_laveurs')).toBe('Pro')
  })
})

describe('tarifs annuels', () => {
  it('facture 10 mois pour 12 (2 mois offerts)', () => {
    expect(yearlyPrice(49)).toBe(490)
    expect(yearlyPrice(69)).toBe(690)
  })
  it('calcule le mensuel équivalent arrondi au centime', () => {
    expect(yearlyMonthlyEquivalent(49)).toBe(40.83)
    expect(yearlyMonthlyEquivalent(69)).toBe(57.5)
  })
  it('formate à la française sans centimes inutiles', () => {
    expect(formatEuros(40.83)).toBe('40,83')
    expect(formatEuros(490)).toBe('490')
  })
  it('complète les centimes manquants sur un montant non rond', () => {
    expect(formatEuros(57.5)).toBe('57,50')
  })
})

// `graceEnded` et `monthsOwed` décident respectivement si on BLOQUE les
// réservations d'un laveur et COMBIEN il doit payer. Elles n'étaient couvertes
// par aucun test (33 % de branches sur ce fichier au 2026-08-30) alors qu'une
// erreur y coupe l'activité d'un client payant ou lui réclame le mauvais
// montant. Les dates sont figées : un test de facturation qui dépend de
// l'horloge du jour finit toujours par échouer un lundi matin.
describe('graceEnded — fin du délai de grâce (30 jours)', () => {
  const echeance = '2026-01-01T00:00:00.000Z'

  it('ne bloque pas avant la fin des 30 jours', () => {
    expect(graceEnded(echeance, null, new Date('2026-01-15T00:00:00.000Z'))).toBe(false)
  })

  it('ne bloque pas le dernier jour du délai', () => {
    expect(graceEnded(echeance, null, new Date('2026-01-31T00:00:00.000Z'))).toBe(false)
  })

  it('bloque une fois les 30 jours dépassés', () => {
    expect(graceEnded(echeance, null, new Date('2026-02-05T00:00:00.000Z'))).toBe(true)
  })

  it('sans aucune date, ne bloque pas — on ne coupe pas un compte sur une absence d’information', () => {
    expect(graceEnded(null, null, new Date('2030-01-01T00:00:00.000Z'))).toBe(false)
  })

  it('retombe sur la fin d’essai quand le laveur n’a jamais été abonné', () => {
    const finEssai = '2026-03-01T00:00:00.000Z'
    expect(graceEnded(null, finEssai, new Date('2026-03-20T00:00:00.000Z'))).toBe(false)
    expect(graceEnded(null, finEssai, new Date('2026-04-10T00:00:00.000Z'))).toBe(true)
  })

  it('privilégie l’échéance d’abonnement sur la fin d’essai quand les deux existent', () => {
    // Essai fini depuis longtemps mais abonnement récent : le laveur a payé,
    // il ne doit surtout pas être bloqué.
    const finEssai = '2026-01-01T00:00:00.000Z'
    const finAbo = '2026-06-01T00:00:00.000Z'
    expect(graceEnded(finAbo, finEssai, new Date('2026-06-15T00:00:00.000Z'))).toBe(false)
  })
})

describe('monthsOwed — mois dus après échéance', () => {
  const echeance = '2026-01-01T00:00:00.000Z'

  it('ne doit rien tant que l’échéance n’est pas passée', () => {
    expect(monthsOwed(echeance, null, new Date('2025-12-20T00:00:00.000Z'))).toBe(0)
  })

  it('ne doit rien le jour même de l’échéance', () => {
    expect(monthsOwed(echeance, null, new Date('2026-01-01T00:00:00.000Z'))).toBe(0)
  })

  it('doit un mois dès le lendemain', () => {
    expect(monthsOwed(echeance, null, new Date('2026-01-02T00:00:00.000Z'))).toBe(1)
  })

  it('doit toujours un mois à 29 jours de retard', () => {
    expect(monthsOwed(echeance, null, new Date('2026-01-30T00:00:00.000Z'))).toBe(1)
  })

  it('passe à deux mois après 30 jours de retard', () => {
    expect(monthsOwed(echeance, null, new Date('2026-01-31T12:00:00.000Z'))).toBe(2)
  })

  it('passe à trois mois après 60 jours de retard', () => {
    expect(monthsOwed(echeance, null, new Date('2026-03-02T12:00:00.000Z'))).toBe(3)
  })

  it('ne réclame rien sans aucune date connue', () => {
    expect(monthsOwed(null, null, new Date('2030-01-01T00:00:00.000Z'))).toBe(0)
  })

  it('retombe sur la fin d’essai quand le laveur n’a jamais été abonné', () => {
    expect(monthsOwed(null, '2026-01-01T00:00:00.000Z', new Date('2026-01-15T00:00:00.000Z'))).toBe(1)
  })
})

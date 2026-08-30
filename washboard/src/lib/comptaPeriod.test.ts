import { describe, it, expect } from 'vitest'
import { getPeriodRange, navigatePeriod, isCurrentPeriod } from './comptaPeriod'

// Ces bornes décident sur quelle plage le CA et les dépenses sont calculés :
// un décalage d'un jour donne un résultat comptable faux, en silence.

describe('getPeriodRange — jour', () => {
  it('borne le jour sur lui-même', () => {
    const r = getPeriodRange('jour', new Date(2026, 8, 9, 14, 0))
    expect(r.start).toBe('2026-09-09')
    expect(r.end).toBe('2026-09-09')
  })

  it('donne le bon jour même consulté juste après minuit', () => {
    // Régression : l'ancienne version passait par toISOString() (donc UTC).
    // La France étant en avance sur UTC, une consultation à 1 h du matin
    // renvoyait la veille — le laveur voyait la compta du mauvais jour.
    const r = getPeriodRange('jour', new Date(2026, 8, 9, 0, 30))
    expect(r.start).toBe('2026-09-09')
  })

  it('reste correct le 1er janvier juste après minuit', () => {
    // Cas limite : un décalage UTC ferait basculer sur l'année précédente.
    const r = getPeriodRange('jour', new Date(2026, 0, 1, 0, 15))
    expect(r.start).toBe('2026-01-01')
  })
})

describe('getPeriodRange — semaine', () => {
  it('commence un lundi et finit le dimanche suivant', () => {
    // Régression majeure : l'ancienne version renvoyait le dimanche précédent
    // comme début, donc la semaine comptable était décalée en permanence.
    const r = getPeriodRange('semaine', new Date(2026, 8, 9, 14, 0)) // mercredi
    expect(r.start).toBe('2026-09-07') // lundi
    expect(r.end).toBe('2026-09-13')   // dimanche
  })

  it('un dimanche appartient à la semaine qui a commencé le lundi précédent', () => {
    const r = getPeriodRange('semaine', new Date(2026, 8, 13, 20, 0))
    expect(r.start).toBe('2026-09-07')
    expect(r.end).toBe('2026-09-13')
  })

  it('un lundi est le premier jour de sa propre semaine', () => {
    const r = getPeriodRange('semaine', new Date(2026, 8, 7, 8, 0))
    expect(r.start).toBe('2026-09-07')
  })

  it('gère une semaine à cheval sur deux mois', () => {
    const r = getPeriodRange('semaine', new Date(2026, 8, 30)) // mercredi 30 sept
    expect(r.start).toBe('2026-09-28')
    expect(r.end).toBe('2026-10-04')
  })
})

describe('getPeriodRange — mois', () => {
  it('couvre le mois entier', () => {
    const r = getPeriodRange('mois', new Date(2026, 8, 15))
    expect(r.start).toBe('2026-09-01')
    expect(r.end).toBe('2026-09-30')
  })

  it('gère un mois de 31 jours', () => {
    const r = getPeriodRange('mois', new Date(2026, 0, 15))
    expect(r.end).toBe('2026-01-31')
  })

  it('gère février d’une année bissextile', () => {
    expect(getPeriodRange('mois', new Date(2024, 1, 10)).end).toBe('2024-02-29')
    expect(getPeriodRange('mois', new Date(2026, 1, 10)).end).toBe('2026-02-28')
  })

  it('affiche le mois en français', () => {
    expect(getPeriodRange('mois', new Date(2026, 8, 15)).label).toBe('Septembre 2026')
  })
})

describe('getPeriodRange — année', () => {
  it('couvre l’année civile', () => {
    const r = getPeriodRange('annee', new Date(2026, 5, 15))
    expect(r.start).toBe('2026-01-01')
    expect(r.end).toBe('2026-12-31')
    expect(r.label).toBe('2026')
  })
})

describe('navigatePeriod', () => {
  it('recule et avance d’un jour', () => {
    const base = new Date(2026, 8, 9)
    expect(navigatePeriod('jour', base, -1).getDate()).toBe(8)
    expect(navigatePeriod('jour', base, 1).getDate()).toBe(10)
  })

  it('avance d’une semaine entière', () => {
    expect(navigatePeriod('semaine', new Date(2026, 8, 9), 1).getDate()).toBe(16)
  })

  it('change de mois et gère le passage d’année', () => {
    expect(navigatePeriod('mois', new Date(2026, 11, 15), 1).getFullYear()).toBe(2027)
    expect(navigatePeriod('mois', new Date(2026, 0, 15), -1).getFullYear()).toBe(2025)
  })

  it('change d’année', () => {
    expect(navigatePeriod('annee', new Date(2026, 5, 1), 1).getFullYear()).toBe(2027)
  })

  it('ne modifie pas la date reçue', () => {
    const base = new Date(2026, 8, 9)
    navigatePeriod('jour', base, 1)
    expect(base.getDate()).toBe(9)
  })
})

describe('isCurrentPeriod', () => {
  const maintenant = new Date(2026, 8, 9, 14, 0) // mercredi 9 septembre 2026

  it('reconnaît le jour en cours', () => {
    expect(isCurrentPeriod(new Date(2026, 8, 9, 8, 0), 'jour', maintenant)).toBe(true)
    expect(isCurrentPeriod(new Date(2026, 8, 8), 'jour', maintenant)).toBe(false)
  })

  it('reconnaît la semaine en cours quel que soit le jour choisi', () => {
    expect(isCurrentPeriod(new Date(2026, 8, 7), 'semaine', maintenant)).toBe(true)
    expect(isCurrentPeriod(new Date(2026, 8, 13), 'semaine', maintenant)).toBe(true)
    expect(isCurrentPeriod(new Date(2026, 8, 14), 'semaine', maintenant)).toBe(false)
  })

  it('reconnaît le mois en cours', () => {
    expect(isCurrentPeriod(new Date(2026, 8, 1), 'mois', maintenant)).toBe(true)
    expect(isCurrentPeriod(new Date(2026, 7, 31), 'mois', maintenant)).toBe(false)
  })

  it('distingue le même mois d’une autre année', () => {
    expect(isCurrentPeriod(new Date(2025, 8, 9), 'mois', maintenant)).toBe(false)
  })

  it('reconnaît l’année en cours', () => {
    expect(isCurrentPeriod(new Date(2026, 0, 1), 'annee', maintenant)).toBe(true)
    expect(isCurrentPeriod(new Date(2025, 11, 31), 'annee', maintenant)).toBe(false)
  })
})

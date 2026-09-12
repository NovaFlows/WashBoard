import { describe, it, expect } from 'vitest'
import { resumeCrm, ecartRelatif } from './crmStats'
import { previousCrmPeriod, isCrmPeriodInProgress, type CrmPeriodState } from './crmPeriod'

const resa = (status: string, prix: number, closed_late = false) =>
  ({ status, closed_late, booked_price: prix, services: { price: 999 } })

describe('resumeCrm', () => {
  const lot = [
    resa('done', 80), resa('done', 60, true), resa('confirmed', 40),
    resa('pending', 50), resa('cancelled', 70),
  ]

  it('compte le CA des seules réservations confirmées ou terminées, retards compris', () => {
    const r = resumeCrm(lot)
    expect(r.ca).toBe(180)
    expect(r.comptees).toBe(3)
  })

  it('calcule le panier moyen sur ces mêmes réservations, pas sur le total', () => {
    // 180 € / 3 — diviser par 5 mêlerait une annulation et une attente à 0 €
    expect(resumeCrm(lot).panierMoyen).toBe(60)
  })

  it('isole les réservations en attente, et le taux de confirmation', () => {
    const r = resumeCrm(lot)
    expect(r.enAttente).toBe(1)
    expect(r.tauxConfirmation).toBe(60)
  })

  it('reste à zéro sans réservation, sans division par zéro', () => {
    expect(resumeCrm([])).toEqual({ total: 0, enAttente: 0, ca: 0, comptees: 0, panierMoyen: 0, tauxConfirmation: 0 })
  })
})

describe('ecartRelatif', () => {
  it('mesure la hausse et la baisse', () => {
    expect(ecartRelatif(120, 100)).toBe(20)
    expect(ecartRelatif(75, 100)).toBe(-25)
  })
  it('ne calcule rien sur une référence vide', () => {
    expect(ecartRelatif(50, 0)).toBeNull()
  })
})

describe('previousCrmPeriod', () => {
  const base: CrmPeriodState = { type: 'month', year: 2026, month: 8, weekStart: new Date(2026, 8, 7), day: '2026-09-12' }

  it('remonte d’un mois calendaire, et change d’année en janvier', () => {
    expect(previousCrmPeriod(base)).toMatchObject({ year: 2026, month: 7 })
    expect(previousCrmPeriod({ ...base, month: 0 })).toMatchObject({ year: 2025, month: 11 })
  })

  it('recule d’une semaine et d’une année', () => {
    const s = previousCrmPeriod({ ...base, type: 'week' })!
    expect(s.weekStart.getDate()).toBe(31)
    expect(s.weekStart.getMonth()).toBe(7)
    expect(previousCrmPeriod({ ...base, type: 'year' })).toMatchObject({ year: 2025 })
  })

  it('prend la veille, y compris par-dessus un changement de mois', () => {
    expect(previousCrmPeriod({ ...base, type: 'day', day: '2026-03-01' })?.day).toBe('2026-02-28')
  })

  it('n’a pas d’avant pour « Tout »', () => {
    expect(previousCrmPeriod({ ...base, type: 'all' })).toBeNull()
  })
})

describe('isCrmPeriodInProgress', () => {
  const sept: CrmPeriodState = { type: 'month', year: 2026, month: 8, weekStart: new Date(2026, 8, 7), day: '2026-09-12' }

  it('est vrai pendant le mois, faux dès qu’il est terminé', () => {
    expect(isCrmPeriodInProgress(sept, new Date(2026, 8, 12, 10).getTime())).toBe(true)
    expect(isCrmPeriodInProgress(sept, new Date(2026, 9, 1, 0, 0, 1).getTime())).toBe(false)
  })

  it('n’est jamais « en cours » pour « Tout »', () => {
    expect(isCrmPeriodInProgress({ ...sept, type: 'all' }, Date.now())).toBe(false)
  })
})

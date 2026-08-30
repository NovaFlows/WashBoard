import { describe, it, expect } from 'vitest'
import {
  getStatusKey, comptePourLeCA, effectivePrice, totalRevenue, getLast6Months,
  type RevenueBooking,
} from './crmStats'

describe('getStatusKey', () => {
  it('renvoie le statut brut quand la clôture est à l’heure', () => {
    expect(getStatusKey({ status: 'done', closed_late: false })).toBe('done')
  })
  it('signale une clôture tardive plutôt que d’afficher « terminé »', () => {
    expect(getStatusKey({ status: 'done', closed_late: true })).toBe('closed_late')
  })
  it('traite l’absence d’information comme une clôture à l’heure', () => {
    expect(getStatusKey({ status: 'pending', closed_late: null })).toBe('pending')
  })
})

describe('comptePourLeCA', () => {
  it('compte les réservations terminées', () => {
    expect(comptePourLeCA({ status: 'done' })).toBe(true)
  })
  it('compte aussi les réservations confirmées — choix produit assumé', () => {
    // Le CA affiché inclut le prévisionnel accepté. Ce test fige la règle :
    // si quelqu'un la change, il doit le faire sciemment.
    expect(comptePourLeCA({ status: 'confirmed' })).toBe(true)
  })
  it('exclut les réservations en attente', () => {
    expect(comptePourLeCA({ status: 'pending' })).toBe(false)
  })
  it('exclut les réservations annulées', () => {
    expect(comptePourLeCA({ status: 'cancelled' })).toBe(false)
  })
})

describe('effectivePrice', () => {
  it('retient le prix réellement facturé', () => {
    expect(effectivePrice({ status: 'done', booked_price: 82, services: { price: 65 } })).toBe(82)
  })
  it('retombe sur le tarif de la prestation si aucun prix n’a été figé', () => {
    expect(effectivePrice({ status: 'done', booked_price: null, services: { price: 65 } })).toBe(65)
  })
  it('renvoie 0 quand la prestation a été supprimée', () => {
    // Sans ce repli, le CA d'une réservation passée disparaîtrait le jour où
    // le laveur supprime la prestation correspondante.
    expect(effectivePrice({ status: 'done', booked_price: null, services: null })).toBe(0)
  })
  it('respecte un prix facturé à 0 sans le confondre avec une absence', () => {
    // `?? ` et non `|| ` : un geste commercial à 0 € doit rester 0, pas
    // basculer sur le tarif catalogue.
    expect(effectivePrice({ status: 'done', booked_price: 0, services: { price: 65 } })).toBe(0)
  })
})

describe('totalRevenue', () => {
  const bookings: RevenueBooking[] = [
    { status: 'done', booked_price: 80, services: { price: 65 } },
    { status: 'confirmed', booked_price: 60, services: { price: 65 } },
    { status: 'pending', booked_price: 100, services: { price: 65 } },
    { status: 'cancelled', booked_price: 200, services: { price: 65 } },
  ]

  it('additionne les réservations terminées et confirmées uniquement', () => {
    expect(totalRevenue(bookings)).toBe(140)
  })
  it('renvoie 0 sur une liste vide', () => {
    expect(totalRevenue([])).toBe(0)
  })
  it('n’inclut jamais une annulation, même à prix élevé', () => {
    expect(totalRevenue([{ status: 'cancelled', booked_price: 999, services: null }])).toBe(0)
  })
})

describe('getLast6Months', () => {
  it('renvoie six mois, du plus ancien au plus récent', () => {
    const mois = getLast6Months(new Date(2026, 8, 15)) // septembre 2026
    expect(mois).toHaveLength(6)
    expect(mois[0].month).toBe(3)  // avril
    expect(mois[5].month).toBe(8)  // septembre
  })

  it('remonte correctement sur l’année précédente', () => {
    const mois = getLast6Months(new Date(2026, 1, 10)) // février 2026
    expect(mois[0].year).toBe(2025)
    expect(mois[0].month).toBe(8)   // septembre 2025
    expect(mois[5].year).toBe(2026)
  })

  it('étiquette les mois en français abrégé', () => {
    expect(getLast6Months(new Date(2026, 8, 15))[5].label).toBe('Sep')
  })

  it('fonctionne un 31 du mois sans déborder', () => {
    // `new Date(y, m - i, 1)` évite le piège du 31 dans un mois de 30 jours.
    const mois = getLast6Months(new Date(2026, 6, 31))
    expect(mois[5].month).toBe(6) // juillet, pas août
  })
})

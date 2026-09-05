import { describe, it, expect } from 'vitest'
import {
  verdictDate, heureParis, creneauDansOuverture, BOOKING_HORIZON_DAYS,
} from './bookingWindow'

const JOUR = 24 * 60 * 60_000
const MAINTENANT = new Date('2026-09-05T10:00:00Z').getTime()
const dans = (ms: number) => new Date(MAINTENANT + ms).toISOString()

describe('verdictDate', () => {
  it('accepte un créneau à venir dans la fenêtre proposée', () => {
    expect(verdictDate(dans(2 * JOUR), MAINTENANT)).toBe('ok')
    expect(verdictDate(dans(BOOKING_HORIZON_DAYS * JOUR), MAINTENANT)).toBe('ok')
  })

  it('refuse une date déjà passée', () => {
    // Un appel direct à la route créait un rendez-vous daté de l'an dernier,
    // qui atterrissait dans l'agenda du laveur sans qu'il puisse s'y opposer.
    expect(verdictDate(dans(-JOUR), MAINTENANT)).toBe('passe')
    expect(verdictDate('2020-01-01T09:00:00Z', MAINTENANT)).toBe('passe')
  })

  it('refuse l\'instant présent : un créneau doit être à venir', () => {
    expect(verdictDate(dans(0), MAINTENANT)).toBe('passe')
  })

  it('refuse une date au-delà de l\'horizon', () => {
    expect(verdictDate(dans(90 * JOUR), MAINTENANT)).toBe('trop_loin')
    expect(verdictDate('2099-01-01T09:00:00Z', MAINTENANT)).toBe('trop_loin')
  })

  it('tolère un jour de battement sur la borne haute', () => {
    // Un client qui ouvre la page à 23h59 voit J+14 ; son envoi peut arriver
    // après minuit. Sans cette marge, sa réservation serait refusée alors
    // qu'il n'a rien fait d'anormal.
    expect(verdictDate(dans((BOOKING_HORIZON_DAYS + 1) * JOUR - 1000), MAINTENANT)).toBe('ok')
    expect(verdictDate(dans((BOOKING_HORIZON_DAYS + 1) * JOUR + 60_000), MAINTENANT)).toBe('trop_loin')
  })

  it('refuse une date illisible', () => {
    expect(verdictDate('pas-une-date', MAINTENANT)).toBe('invalide')
    expect(verdictDate('', MAINTENANT)).toBe('invalide')
  })
})

describe('heureParis', () => {
  it('convertit un instant UTC en heure locale française, l\'été', () => {
    // 5 septembre 2026 : heure d'été, Paris = UTC+2.
    expect(heureParis('2026-09-05T08:30:00Z')).toEqual({ jour: 6, minutes: 10 * 60 + 30 })
  })

  it('convertit un instant UTC en heure locale française, l\'hiver', () => {
    // 5 janvier 2026 : heure d'hiver, Paris = UTC+1. C'est ce décalage
    // saisonnier qui interdit de comparer les horaires d'ouverture en UTC —
    // un créneau de 8h passerait l'hiver et échouerait l'été.
    expect(heureParis('2026-01-05T08:30:00Z')).toEqual({ jour: 1, minutes: 9 * 60 + 30 })
  })

  it('gère le passage de minuit, qui change le jour de la semaine', () => {
    // 23h30 UTC un samedi = 01h30 le dimanche à Paris.
    expect(heureParis('2026-09-05T23:30:00Z')).toEqual({ jour: 0, minutes: 90 })
  })

  it('rend null pour une date illisible', () => {
    expect(heureParis('n\'importe quoi')).toBeNull()
  })
})

describe('creneauDansOuverture', () => {
  // Samedi 5 septembre 2026, 08:00 UTC = 10:00 à Paris. Samedi = jour 6.
  const SAMEDI_10H = '2026-09-05T08:00:00Z'
  const plages = [{ day_of_week: 6, start_time: '09:00', end_time: '18:00' }]

  it('accepte un créneau qui commence et se termine dans l\'ouverture', () => {
    expect(creneauDansOuverture(SAMEDI_10H, 60, plages)).toBe(true)
  })

  it('refuse un créneau un jour de fermeture', () => {
    expect(creneauDansOuverture(SAMEDI_10H, 60, [
      { day_of_week: 1, start_time: '09:00', end_time: '18:00' },
    ])).toBe(false)
  })

  it('refuse un créneau avant l\'ouverture', () => {
    // 3h du matin : exactement ce qu'un appel direct pouvait enregistrer.
    expect(creneauDansOuverture('2026-09-05T01:00:00Z', 60, plages)).toBe(false)
  })

  it('refuse une prestation qui déborde après la fermeture', () => {
    // Commence bien à 10h, mais dure 9h : le laveur finirait à 19h.
    expect(creneauDansOuverture(SAMEDI_10H, 9 * 60, plages)).toBe(false)
    expect(creneauDansOuverture(SAMEDI_10H, 8 * 60, plages)).toBe(true)  // pile à 18h
  })

  it('refuse un créneau non aligné sur le pas proposé', () => {
    // L'interface ne propose que 09:00, 09:30, 10:00… Un horaire glissé entre
    // deux créneaux n'est jamais montré à personne.
    expect(creneauDansOuverture('2026-09-05T08:07:00Z', 60, plages)).toBe(false)
    expect(creneauDansOuverture('2026-09-05T08:30:00Z', 60, plages)).toBe(true)
  })

  it('accepte dès qu\'une plage du jour convient', () => {
    const coupure = [
      { day_of_week: 6, start_time: '08:00', end_time: '12:00' },
      { day_of_week: 6, start_time: '14:00', end_time: '19:00' },
    ]
    expect(creneauDansOuverture(SAMEDI_10H, 60, coupure)).toBe(true)
    // 13h à Paris : dans la coupure du midi.
    expect(creneauDansOuverture('2026-09-05T11:00:00Z', 60, coupure)).toBe(false)
  })

  it('laisse passer quand le laveur n\'a saisi aucun horaire', () => {
    // Un compte tout neuf n'a pas encore de disponibilités : bloquer ici
    // rendrait sa page de réservation inutilisable dès le premier jour.
    expect(creneauDansOuverture(SAMEDI_10H, 60, [])).toBe(true)
  })

  it('refuse une date illisible', () => {
    expect(creneauDansOuverture('pas-une-date', 60, plages)).toBe(false)
  })

  it('ignore une plage aux horaires aberrants plutôt que de s\'y fier', () => {
    expect(creneauDansOuverture(SAMEDI_10H, 60, [
      { day_of_week: 6, start_time: 'nawak', end_time: '18:00' },
    ])).toBe(false)
    expect(creneauDansOuverture(SAMEDI_10H, 60, [
      { day_of_week: 6, start_time: '09:00', end_time: '99:99' },
    ])).toBe(false)
  })
})

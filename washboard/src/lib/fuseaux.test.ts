// Un laveur hors de l'heure de Paris (Cayenne, UTC−3 toute l'année).
//
// Ces tests doivent passer quel que soit le fuseau de la machine qui les
// exécute. Pour reproduire la prod :  TZ=UTC npx vitest run src/lib/fuseaux.test.ts
import { describe, it, expect } from 'vitest'
import {
  FUSEAU, dateStrParis, instantParis, aujourdhuiParis, formatHeure, formatHeureCompacte, minuitParisUTC,
} from './dateUtils'
import { heureParis, estAujourdhuiParis, creneauDansOuverture } from './bookingWindow'
import { debutCreneauIso, slotEstPasse, countOverlaps, isSlotFeasible } from './slots'
import { fuseauDuLaveur, estFuseauPropose, FUSEAUX_PROPOSES } from './fuseaux'

const CAYENNE = 'America/Cayenne'

describe('fuseau du laveur : valeur lue en base', () => {
  it('retombe sur Paris pour tout ce qui n’est pas un fuseau proposé', () => {
    expect(fuseauDuLaveur(null)).toBe(FUSEAU)
    expect(fuseauDuLaveur(undefined)).toBe(FUSEAU)
    expect(fuseauDuLaveur({})).toBe(FUSEAU)
    expect(fuseauDuLaveur({ fuseau: null })).toBe(FUSEAU)
    expect(fuseauDuLaveur({ fuseau: 'america/cayenne' })).toBe(FUSEAU)
    expect(fuseauDuLaveur({ fuseau: 'UTC' })).toBe(FUSEAU)
    expect(fuseauDuLaveur('Asia/Tokyo')).toBe(FUSEAU)
  })

  it('garde un fuseau proposé', () => {
    expect(fuseauDuLaveur({ fuseau: CAYENNE })).toBe(CAYENNE)
    expect(fuseauDuLaveur(CAYENNE)).toBe(CAYENNE)
    expect(estFuseauPropose('Europe/Paris')).toBe(true)
  })

  it('chaque fuseau proposé est reconnu par le moteur (Node comme navigateur)', () => {
    for (const f of FUSEAUX_PROPOSES) {
      expect(() => new Intl.DateTimeFormat('fr-FR', { timeZone: f.id })).not.toThrow()
    }
  })
})

describe('Cayenne : heures et jours', () => {
  it('8 h à Cayenne = 11 h UTC, toute l’année (pas d’heure d’été)', () => {
    expect(new Date(instantParis(2026, 12, 10, 8, 0, CAYENNE)).toISOString()).toBe('2026-12-10T11:00:00.000Z')
    expect(new Date(instantParis(2026, 7, 10, 8, 0, CAYENNE)).toISOString()).toBe('2026-07-10T11:00:00.000Z')
  })

  it('affiche l’heure de Cayenne, pas celle de Paris', () => {
    const rdv = new Date('2026-12-10T11:00:00Z')
    expect(formatHeure(rdv, CAYENNE)).toBe('08:00')
    expect(formatHeureCompacte(rdv, CAYENNE)).toBe('8h')
    // Le même instant, à Paris : 12 h. C'était l'affichage d'avant pour ce laveur.
    expect(formatHeure(rdv)).toBe('12:00')
  })

  it('« aujourd’hui » ne bascule qu’à minuit de Cayenne', () => {
    // 22 h à Cayenne le 10 = 2 h du matin le 11 à Paris.
    const soir = new Date('2026-12-11T01:00:00Z')
    expect(dateStrParis(soir, CAYENNE)).toBe('2026-12-10')
    expect(dateStrParis(soir)).toBe('2026-12-11')
    const a = aujourdhuiParis(soir, CAYENNE)
    expect([a.getFullYear(), a.getMonth() + 1, a.getDate()]).toEqual([2026, 12, 10])
  })

  it('minuit de Cayenne en UTC', () => {
    expect(minuitParisUTC('2026-12-10', CAYENNE).toISOString()).toBe('2026-12-10T03:00:00.000Z')
    // Paris inchangé, des deux côtés d'un changement d'heure.
    expect(minuitParisUTC('2026-12-10').toISOString()).toBe('2026-12-09T23:00:00.000Z')
    expect(minuitParisUTC('2026-07-10').toISOString()).toBe('2026-07-09T22:00:00.000Z')
    expect(minuitParisUTC('2026-03-29').toISOString()).toBe('2026-03-28T23:00:00.000Z')
    expect(minuitParisUTC('2026-10-25').toISOString()).toBe('2026-10-24T22:00:00.000Z')
  })
})

describe('Cayenne : réservation', () => {
  // Jeudi 10 décembre 2026, plage 8 h – 18 h.
  const jeudi = new Date(2026, 11, 10)
  const plages = [{ day_of_week: 4, start_time: '08:00', end_time: '18:00' }]

  it('le créneau « 08:00 » part à 8 h de Cayenne', () => {
    expect(debutCreneauIso('08:00', jeudi, CAYENNE)).toBe('2026-12-10T11:00:00.000Z')
    expect(debutCreneauIso('08:00', jeudi)).toBe('2026-12-10T07:00:00.000Z')
  })

  it('le serveur accepte ce créneau dans les horaires de Cayenne…', () => {
    const iso = debutCreneauIso('08:00', jeudi, CAYENNE)
    expect(heureParis(iso, CAYENNE)).toEqual({ jour: 4, minutes: 8 * 60 })
    expect(creneauDansOuverture(iso, 60, plages, undefined, CAYENNE)).toBe(true)
  })

  it('… et refuserait le même instant lu à l’heure de Paris (12 h) si la plage finissait à 12 h', () => {
    const iso = debutCreneauIso('08:00', jeudi, CAYENNE)
    const matin = [{ day_of_week: 4, start_time: '08:00', end_time: '12:00' }]
    expect(creneauDansOuverture(iso, 60, matin, undefined, CAYENNE)).toBe(true)
    expect(creneauDansOuverture(iso, 60, matin)).toBe(false)
  })

  it('à 9 h du matin à Cayenne, le créneau de 10 h n’est pas « déjà passé »', () => {
    const neufHeures = Date.parse('2026-12-10T12:00:00Z') // 9 h Cayenne, 13 h Paris
    expect(slotEstPasse('10:00', jeudi, neufHeures, CAYENNE)).toBe(false)
    expect(slotEstPasse('08:00', jeudi, neufHeures, CAYENNE)).toBe(true)
    // Lu à l'heure de Paris, 10 h serait passé : c'est le bug corrigé.
    expect(slotEstPasse('10:00', jeudi, neufHeures)).toBe(true)
  })

  it('le jour même se juge à la date de Cayenne', () => {
    const soir = Date.parse('2026-12-11T01:00:00Z') // 22 h le 10 à Cayenne
    expect(estAujourdhuiParis('2026-12-10T20:00:00Z', soir, CAYENNE)).toBe(true)
    expect(estAujourdhuiParis('2026-12-11T13:00:00Z', soir, CAYENNE)).toBe(false)
  })

  it('un rendez-vous existant à 8 h bloque le créneau 8 h, pas un autre', () => {
    const pris = [{ scheduled_at: '2026-12-10T11:00:00Z', durationMin: 60 }]
    expect(countOverlaps('08:00', jeudi, 60, pris, CAYENNE)).toBe(1)
    expect(countOverlaps('09:00', jeudi, 60, pris, CAYENNE)).toBe(0)
    expect(isSlotFeasible('08:30', jeudi, 60, [{ start: '2026-12-10T11:00:00Z', end: '2026-12-10T12:00:00Z', travelToNew: 0, travelFromNew: 0 }], CAYENNE)).toBe(false)
  })
})

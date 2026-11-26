// Calcul des heures et des jours dans chaque fuseau d'outre-mer.
//
// Complète `fuseaux.test.ts` (Cayenne) : La Réunion (UTC+4), Nouméa (UTC+11,
// la date change avant Paris), Saint-Pierre-et-Miquelon (heure d'été
// américaine), et la garantie qu'un laveur de Paris garde EXACTEMENT les mêmes
// résultats qu'avant. Doivent passer quel que soit le fuseau de la machine :
//   TZ=UTC npx vitest run src/lib/fuseauxDates.test.ts
import { describe, it, expect } from 'vitest'
import {
  FUSEAU, dateStrParis, instantParis, instantSaisi, saisieDe, aujourdhuiParis,
  formatHeure, formatHeureCompacte, minuitParisUTC,
} from './dateUtils'
import { heureParis, estAujourdhuiParis, creneauDansOuverture } from './bookingWindow'
import { debutCreneauIso, slotEstPasse, isSlotInWindows } from './slots'
import { partiesParis, jourParisDe, aujourdhuiParis as jourDuJour, bornesInstants } from './chiffresPeriode'
import { semaineAccueil } from './semaineAccueil'
import { FUSEAUX_PROPOSES } from './fuseaux'

const CAYENNE = 'America/Cayenne'
const REUNION = 'Indian/Reunion'
const NOUMEA = 'Pacific/Noumea'
const MIQUELON = 'America/Miquelon'

describe('saisie du laveur dans son agenda (instantSaisi / saisieDe)', () => {
  it('« 8 h » saisi est 8 h dans son fuseau, quel que soit l’appareil', () => {
    expect(instantSaisi('2026-12-10', '08:00', CAYENNE).toISOString()).toBe('2026-12-10T11:00:00.000Z')
    expect(instantSaisi('2026-12-10', '08:00', REUNION).toISOString()).toBe('2026-12-10T04:00:00.000Z')
    expect(instantSaisi('2026-12-10', '08:00', NOUMEA).toISOString()).toBe('2026-12-09T21:00:00.000Z')
    expect(instantSaisi('2026-12-10', '08:00').toISOString()).toBe('2026-12-10T07:00:00.000Z')
    expect(instantSaisi('2026-07-10', '08:00').toISOString()).toBe('2026-07-10T06:00:00.000Z')
  })

  it('accepte une heure à un chiffre et des secondes (champ « time » du navigateur)', () => {
    expect(instantSaisi('2026-12-10', '8:30', CAYENNE).toISOString()).toBe('2026-12-10T11:30:00.000Z')
    expect(instantSaisi('2026-12-10', '08:30:00', CAYENNE).toISOString()).toBe('2026-12-10T11:30:00.000Z')
  })

  it('une saisie illisible donne une date invalide, comme avant', () => {
    expect(Number.isNaN(instantSaisi('', '08:00', CAYENNE).getTime())).toBe(true)
    expect(Number.isNaN(instantSaisi('2026-12-10', '', CAYENNE).getTime())).toBe(true)
    expect(Number.isNaN(instantSaisi('10/12/2026', '08:00').getTime())).toBe(true)
    expect(Number.isNaN(instantSaisi('2026-12-10', 'midi').getTime())).toBe(true)
  })

  it('aller-retour exact dans chaque fuseau, été comme hiver', () => {
    for (const { id } of FUSEAUX_PROPOSES) {
      for (const [date, heure] of [['2026-01-15', '07:45'], ['2026-07-15', '18:30'], ['2026-12-31', '23:30'], ['2026-03-01', '00:00']]) {
        expect(saisieDe(instantSaisi(date, heure, id), id), `${id} ${date} ${heure}`).toEqual({ date, heure })
      }
    }
  })

  it('pré-remplit le formulaire avec l’heure du laveur, pas celle de Paris', () => {
    const rdv = new Date('2026-12-10T11:00:00Z')
    expect(saisieDe(rdv, CAYENNE)).toEqual({ date: '2026-12-10', heure: '08:00' })
    expect(saisieDe(rdv)).toEqual({ date: '2026-12-10', heure: '12:00' })
    // Minuit pile : jamais « 24:00 ».
    expect(saisieDe(new Date('2026-12-10T03:00:00Z'), CAYENNE)).toEqual({ date: '2026-12-10', heure: '00:00' })
  })
})

describe('Paris : rien ne change pour les laveurs actuels', () => {
  it('sans fuseau, chaque fonction donne le résultat de Paris', () => {
    const t = new Date('2026-10-25T09:30:00Z') // jour du retour à l'heure d'hiver
    expect(formatHeure(t)).toBe(formatHeure(t, FUSEAU))
    expect(formatHeure(t)).toBe('10:30')
    expect(dateStrParis(t)).toBe('2026-10-25')
    expect(instantParis(2026, 10, 25, 10, 30)).toBe(t.getTime())
    expect(heureParis(t.toISOString())).toEqual({ jour: 0, minutes: 10 * 60 + 30 })
    expect(minuitParisUTC('2026-10-25').toISOString()).toBe('2026-10-24T22:00:00.000Z')
    expect(partiesParis(t)).toEqual({ jour: '2026-10-25', heure: 10 })
  })

  it('changement d’heure de mars : 8 h reste 8 h de part et d’autre', () => {
    expect(new Date(instantParis(2026, 3, 28, 8, 0)).toISOString()).toBe('2026-03-28T07:00:00.000Z')
    expect(new Date(instantParis(2026, 3, 29, 8, 0)).toISOString()).toBe('2026-03-29T06:00:00.000Z')
  })
})

describe('La Réunion (UTC+4, la journée commence avant Paris)', () => {
  it('heures et jours', () => {
    const rdv = new Date('2026-12-10T05:00:00Z')
    expect(formatHeure(rdv, REUNION)).toBe('09:00')
    expect(formatHeureCompacte(rdv, REUNION)).toBe('9h')
    expect(formatHeureCompacte(new Date('2026-12-10T05:30:00Z'), REUNION)).toBe('9h30')
    // 22 h à Paris le 10 = 1 h du matin le 11 à La Réunion.
    const nuit = new Date('2026-12-10T21:00:00Z')
    expect(dateStrParis(nuit, REUNION)).toBe('2026-12-11')
    expect(dateStrParis(nuit)).toBe('2026-12-10')
    const a = aujourdhuiParis(nuit, REUNION)
    expect([a.getFullYear(), a.getMonth() + 1, a.getDate()]).toEqual([2026, 12, 11])
    expect(minuitParisUTC('2026-12-11', REUNION).toISOString()).toBe('2026-12-10T20:00:00.000Z')
  })

  it('créneau, horaires et « déjà passé »', () => {
    const jeudi = new Date(2026, 11, 10)
    const iso = debutCreneauIso('09:00', jeudi, REUNION)
    expect(iso).toBe('2026-12-10T05:00:00.000Z')
    expect(creneauDansOuverture(iso, 60, [{ day_of_week: 4, start_time: '08:00', end_time: '12:00' }], undefined, REUNION)).toBe(true)
    // À Paris, ce même instant est 6 h : hors de la plage.
    expect(creneauDansOuverture(iso, 60, [{ day_of_week: 4, start_time: '08:00', end_time: '12:00' }])).toBe(false)
    expect(slotEstPasse('09:00', jeudi, Date.parse('2026-12-10T04:00:00Z'), REUNION)).toBe(false)
    expect(slotEstPasse('09:00', jeudi, Date.parse('2026-12-10T05:00:00Z'), REUNION)).toBe(true)
  })
})

describe('Nouméa (UTC+11, la date change avant Paris)', () => {
  it('lundi 8 h à Nouméa est encore dimanche à Paris : le jour de la semaine suit Nouméa', () => {
    const iso = new Date(instantParis(2026, 12, 14, 8, 0, NOUMEA)).toISOString() // lundi 14
    expect(iso).toBe('2026-12-13T21:00:00.000Z')
    expect(heureParis(iso, NOUMEA)).toEqual({ jour: 1, minutes: 8 * 60 })
    expect(heureParis(iso)).toEqual({ jour: 0, minutes: 22 * 60 })
    const lundi = [{ day_of_week: 1, start_time: '08:00', end_time: '12:00' }]
    expect(creneauDansOuverture(iso, 60, lundi, undefined, NOUMEA)).toBe(true)
    expect(creneauDansOuverture(iso, 60, lundi)).toBe(false)
  })

  it('le jour même se juge à la date de Nouméa', () => {
    const maintenant = Date.parse('2026-12-13T20:00:00Z') // 7 h le lundi 14 à Nouméa, 21 h dimanche à Paris
    expect(estAujourdhuiParis('2026-12-13T23:00:00Z', maintenant, NOUMEA)).toBe(true)
    expect(estAujourdhuiParis('2026-12-13T23:00:00Z', maintenant)).toBe(false)
  })
})

describe('Saint-Pierre-et-Miquelon (heure d’été américaine, pas européenne)', () => {
  it('8 h reste 8 h, avec un décalage qui change à d’autres dates que Paris', () => {
    expect(new Date(instantParis(2026, 1, 15, 8, 0, MIQUELON)).toISOString()).toBe('2026-01-15T11:00:00.000Z')
    expect(new Date(instantParis(2026, 7, 15, 8, 0, MIQUELON)).toISOString()).toBe('2026-07-15T10:00:00.000Z')
    // 20 mars 2026 : déjà l'heure d'été à Miquelon (8 mars), pas encore à Paris (29 mars).
    expect(saisieDe(instantSaisi('2026-03-20', '08:00', MIQUELON), MIQUELON)).toEqual({ date: '2026-03-20', heure: '08:00' })
    expect(instantSaisi('2026-03-20', '08:00', MIQUELON).toISOString()).toBe('2026-03-20T10:00:00.000Z')
  })
})

describe('créneaux intelligents et statistiques', () => {
  it('isSlotInWindows compare l’instant du créneau dans le fuseau du laveur', () => {
    const jeudi = new Date(2026, 11, 10)
    const fenetre = [{ start: '2026-12-10T11:00:00Z', end: '2026-12-10T13:00:00Z' }] // 8 h – 10 h à Cayenne
    expect(isSlotInWindows('09:00', jeudi, fenetre, CAYENNE)).toBe(true)
    expect(isSlotInWindows('09:00', jeudi, fenetre)).toBe(false)
  })

  it('jour et heure d’un rendez-vous pour les graphiques', () => {
    expect(partiesParis('2026-12-11T01:00:00Z', CAYENNE)).toEqual({ jour: '2026-12-10', heure: 22 })
    expect(jourParisDe('2026-12-11T01:00:00Z', CAYENNE)).toBe('2026-12-10')
    expect(jourParisDe('2026-12-11T01:00:00Z')).toBe('2026-12-11')
    expect(jourDuJour(Date.parse('2026-12-11T01:00:00Z'), CAYENNE)).toBe('2026-12-10')
    expect(partiesParis('pas une date', CAYENNE)).toBeNull()
  })

  it('bornes d’une journée et d’un mois, de minuit à minuit du laveur', () => {
    expect(bornesInstants({ type: 'jour', ref: '2026-12-10' }, CAYENNE)).toEqual({
      debut: new Date('2026-12-10T03:00:00Z'), fin: new Date('2026-12-11T03:00:00Z'),
    })
    expect(bornesInstants({ type: 'jour', ref: '2026-12-10' })).toEqual({
      debut: new Date('2026-12-09T23:00:00Z'), fin: new Date('2026-12-10T23:00:00Z'),
    })
    const mois = bornesInstants({ type: 'mois', ref: '2026-12-10' }, REUNION)
    expect(mois.debut.toISOString()).toBe('2026-11-30T20:00:00.000Z')
    expect(mois.fin.toISOString()).toBe('2026-12-31T20:00:00.000Z')
  })
})

describe('semaine de l’accueil', () => {
  it('un rendez-vous de 22 h à Cayenne compte pour son jour, pas pour le lendemain', () => {
    // Jeudi 10 décembre 2026, 22 h à Cayenne = vendredi 11, 2 h à Paris.
    const rdv = [{ scheduled_at: '2026-12-11T01:00:00Z', status: 'confirmed' as const }]
    const cayenne = semaineAccueil(rdv, '2026-12-10', null, CAYENNE)
    expect(cayenne.find(j => j.jour === '2026-12-10')?.etat).toBe('confirme')
    expect(cayenne.find(j => j.jour === '2026-12-11')?.etat).toBe('vide')
    const paris = semaineAccueil(rdv, '2026-12-10', null)
    expect(paris.find(j => j.jour === '2026-12-11')?.etat).toBe('confirme')
  })
})

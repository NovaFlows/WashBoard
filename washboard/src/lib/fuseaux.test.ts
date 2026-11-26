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
import { fuseauDuLaveur, fuseauDeLAdresse, fuseauDuTelephone, estFuseauPropose, FUSEAUX_PROPOSES } from './fuseaux'

const CAYENNE = 'America/Cayenne'

describe('fuseau du laveur : déduit de l’adresse puis du téléphone', () => {
  it('Paris pour tous les laveurs actuels de métropole, Belgique, Suisse', () => {
    expect(fuseauDuLaveur(null)).toBe(FUSEAU)
    expect(fuseauDuLaveur({})).toBe(FUSEAU)
    expect(fuseauDuLaveur({ base_address: '12 Rue de Rivoli, 75001 Paris, France', phone: '0612345678' })).toBe(FUSEAU)
    expect(fuseauDuLaveur({ base_address: '3 Cours Mirabeau, 13100 Aix-en-Provence', phone: null })).toBe(FUSEAU)
    expect(fuseauDuLaveur({ base_address: '5 Cours Napoléon, 20000 Ajaccio, France', phone: '0612345678' })).toBe(FUSEAU)
    expect(fuseauDuLaveur({ base_address: 'Rue Neuve 1, 1000 Bruxelles, Belgique', phone: '+32470123456' })).toBe(FUSEAU)
    expect(fuseauDuLaveur({ base_address: null, phone: '+41791234567' })).toBe(FUSEAU)
    expect(fuseauDuLaveur({ base_address: null, phone: '0712345678' })).toBe(FUSEAU)
  })

  it('un nom de rue ne déclenche rien', () => {
    expect(fuseauDeLAdresse('8 Rue de la Martinique, 75018 Paris, France')).toBe(FUSEAU)
    expect(fuseauDeLAdresse('Place du Canada, 75008 Paris')).toBe(FUSEAU)
    expect(fuseauDeLAdresse('12 rue du Québec')).toBeNull()
    expect(fuseauDeLAdresse('Avenue de la Réunion')).toBeNull()
  })

  it('Cayenne par le code postal ou le nom', () => {
    expect(fuseauDeLAdresse('12 Rue Lallouette, 97300 Cayenne, Guyane française')).toBe(CAYENNE)
    expect(fuseauDeLAdresse('Cayenne 97300, French Guiana')).toBe(CAYENNE)
    expect(fuseauDeLAdresse('Cayenne, Guyane française')).toBe(CAYENNE)
    expect(fuseauDeLAdresse('Cayenne')).toBe(CAYENNE)
    expect(fuseauDeLAdresse('Kourou, Guyane')).toBe(CAYENNE)
    expect(fuseauDeLAdresse('97310 Kourou')).toBe(CAYENNE)
  })

  it('les autres outre-mer par le code postal', () => {
    expect(fuseauDeLAdresse('97200 Fort-de-France')).toBe('America/Martinique')
    expect(fuseauDeLAdresse('97110 Pointe-à-Pitre')).toBe('America/Guadeloupe')
    expect(fuseauDeLAdresse('97400 Saint-Denis, La Réunion')).toBe('Indian/Reunion')
    expect(fuseauDeLAdresse('Saint-Denis, La Réunion')).toBe('Indian/Reunion')
    expect(fuseauDeLAdresse('97600 Mamoudzou')).toBe('Indian/Mayotte')
    expect(fuseauDeLAdresse('98800 Nouméa')).toBe('Pacific/Noumea')
    expect(fuseauDeLAdresse('98714 Papeete, Tahiti')).toBe('Pacific/Tahiti')
    // Saint-Denis sans précision = la Seine-Saint-Denis, pas La Réunion.
    expect(fuseauDeLAdresse('1 Rue de la République, 93200 Saint-Denis')).toBe(FUSEAU)
  })

  it('le téléphone, quand l’adresse ne dit rien', () => {
    expect(fuseauDuTelephone('0694123456')).toBe(CAYENNE)
    expect(fuseauDuTelephone('0594 12 34 56')).toBe(CAYENNE)
    expect(fuseauDuTelephone('+594 694 12 34 56')).toBe(CAYENNE)
    expect(fuseauDuTelephone('0696123456')).toBe('America/Martinique')
    expect(fuseauDuTelephone('0690123456')).toBe('America/Guadeloupe')
    expect(fuseauDuTelephone('0692123456')).toBe('Indian/Reunion')
    expect(fuseauDuTelephone('0639123456')).toBe('Indian/Mayotte')
    expect(fuseauDuTelephone('+15142345678')).toBe('America/Toronto')
    expect(fuseauDuTelephone('0612345678')).toBeNull()
    expect(fuseauDuLaveur({ base_address: null, phone: '0694123456' })).toBe(CAYENNE)
    expect(fuseauDuLaveur({ base_address: '', phone: '0694123456' })).toBe(CAYENNE)
  })

  it('l’adresse l’emporte sur le téléphone', () => {
    // Un Guyanais installé à Lyon avec son ancien numéro : heure de Paris.
    expect(fuseauDuLaveur({ base_address: '10 Place Bellecour, 69002 Lyon', phone: '0694123456' })).toBe(FUSEAU)
    // Un numéro de métropole, une adresse à Cayenne : heure de Cayenne.
    expect(fuseauDuLaveur({ base_address: '97300 Cayenne', phone: '0612345678' })).toBe(CAYENNE)
  })

  it('ne renvoie qu’un fuseau de la liste, reconnu par le moteur', () => {
    expect(estFuseauPropose('Europe/Paris')).toBe(true)
    expect(estFuseauPropose('Asia/Tokyo')).toBe(false)
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

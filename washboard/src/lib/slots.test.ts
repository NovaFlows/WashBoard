import { describe, it, expect } from 'vitest'
import {
  generateSlots, countOverlaps, countConflicts, isSlotInWindows,
  isSlotFeasible, effectiveTeamSize,
} from './slots'

// Repère local fixe → ISO construits localement pour être TZ-safe
const date = new Date(2026, 0, 15)
const iso = (h: number, m = 0) => new Date(2026, 0, 15, h, m, 0, 0).toISOString()
const ms  = (h: number, m = 0) => new Date(2026, 0, 15, h, m, 0, 0).getTime()

// ─────────────────────────────────────────────────────────────────────────
describe('generateSlots — génération de créneaux', () => {
  it('génère par pas de 30 min en gardant ceux qui tiennent avant la fin', () => {
    expect(generateSlots('08:00', '10:00', 60)).toEqual(['08:00', '08:30', '09:00'])
  })
  it('le dernier créneau peut finir pile à l’heure de fermeture', () => {
    expect(generateSlots('08:00', '09:00', 60)).toEqual(['08:00'])     // 08:00→09:00 pile
    expect(generateSlots('08:00', '09:30', 90)).toEqual(['08:00'])     // 08:00→09:30 pile
  })
  it('renvoie vide si la durée ne tient pas', () => {
    expect(generateSlots('08:00', '08:30', 60)).toEqual([])
    expect(generateSlots('10:00', '10:00', 30)).toEqual([])
  })
  it('respecte un pas personnalisé', () => {
    expect(generateSlots('08:00', '10:00', 30, 60)).toEqual(['08:00', '09:00'])
  })
  it('pas plus petit que la durée → créneaux qui se recouvrent au départ', () => {
    expect(generateSlots('08:00', '09:30', 60, 30)).toEqual(['08:00', '08:30'])
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('countOverlaps — chevauchement avec la capacité', () => {
  it('compte une réservation qui chevauche', () => {
    expect(countOverlaps('10:00', date, 60, [{ scheduled_at: iso(10, 30), durationMin: 30 }])).toBe(1)
  })
  it('back-to-back : un RDV qui finit pile au début du créneau ne compte PAS', () => {
    expect(countOverlaps('10:00', date, 60, [{ scheduled_at: iso(9, 0), durationMin: 60 }])).toBe(0) // 09:00→10:00
  })
  it('un RDV qui commence pile à la fin du créneau ne compte PAS', () => {
    expect(countOverlaps('10:00', date, 60, [{ scheduled_at: iso(11, 0), durationMin: 60 }])).toBe(0) // 11:00→12:00
  })
  it('RDV entièrement inclus dans le créneau', () => {
    expect(countOverlaps('10:00', date, 120, [{ scheduled_at: iso(10, 30), durationMin: 30 }])).toBe(1)
  })
  it('RDV qui englobe le créneau', () => {
    expect(countOverlaps('10:30', date, 30, [{ scheduled_at: iso(10, 0), durationMin: 120 }])).toBe(1)
  })
  it('compte plusieurs chevauchements', () => {
    expect(countOverlaps('10:00', date, 60, [
      { scheduled_at: iso(10, 0), durationMin: 60 },
      { scheduled_at: iso(10, 30), durationMin: 60 },
      { scheduled_at: iso(12, 0), durationMin: 60 }, // pas de chevauchement
    ])).toBe(2)
  })
  it('aucune réservation → 0', () => {
    expect(countOverlaps('10:00', date, 60, [])).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('countConflicts — barrière serveur anti-double-réservation', () => {
  it('détecte un conflit de chevauchement', () => {
    expect(countConflicts(ms(10, 0), ms(11, 0), [{ startMs: ms(10, 30), durationMin: 60 }])).toBe(1)
  })
  it('back-to-back autorisé (bornes qui se touchent)', () => {
    expect(countConflicts(ms(10, 0), ms(11, 0), [{ startMs: ms(11, 0), durationMin: 60 }])).toBe(0)
    expect(countConflicts(ms(10, 0), ms(11, 0), [{ startMs: ms(9, 0), durationMin: 60 }])).toBe(0)
  })
  it('REPRO BUG PROD : RDV 11:00 (210 min) en conflit avec un nouveau 12:00 (180 min)', () => {
    // existant 11:00→14:30, nouveau 12:00→15:00 → doit être détecté comme conflit
    expect(countConflicts(ms(12, 0), ms(15, 0), [{ startMs: ms(11, 0), durationMin: 210 }])).toBe(1)
  })
  it('compte plusieurs conflits', () => {
    expect(countConflicts(ms(10, 0), ms(13, 0), [
      { startMs: ms(9, 0), durationMin: 120 },  // 09:00→11:00 chevauche
      { startMs: ms(12, 0), durationMin: 30 },   // 12:00→12:30 chevauche
      { startMs: ms(13, 0), durationMin: 60 },   // 13:00→14:00 back-to-back, pas de conflit
    ])).toBe(2)
  })
  it('aucun RDV → 0', () => {
    expect(countConflicts(ms(10, 0), ms(11, 0), [])).toBe(0)
  })

  // Données RÉELLES du bug prod (timestamps UTC exacts, indépendants du fuseau)
  it('REPRO PROD (timestamps réels) : Manon 12:00 (180 min) vs POUILLY 11:00 (210 min) → conflit', () => {
    const pouilly11 = { startMs: Date.parse('2026-07-01T09:00:00Z'), durationMin: 210 } // 11:00→14:30 Paris
    const manonStart = Date.parse('2026-07-01T10:00:00Z')                                 // 12:00 Paris
    const manonEnd   = manonStart + 180 * 60_000                                          // 15:00 Paris
    expect(countConflicts(manonStart, manonEnd, [pouilly11])).toBe(1) // doit être bloqué
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('effectiveTeamSize — capacité un jour donné', () => {
  const dayStr = '2026-01-15'
  it('sans absence → nombre de laveurs', () => {
    expect(effectiveTeamSize(2, [], dayStr)).toBe(2)
  })
  it('absence couvrant le jour → capacité réduite', () => {
    expect(effectiveTeamSize(3, [{ start_date: '2026-01-10', end_date: '2026-01-20', team_members_off: 1 }], dayStr)).toBe(2)
  })
  it('toute l’équipe absente → 0 (jamais négatif)', () => {
    expect(effectiveTeamSize(1, [{ start_date: dayStr, end_date: dayStr, team_members_off: 1 }], dayStr)).toBe(0)
    expect(effectiveTeamSize(2, [{ start_date: dayStr, end_date: dayStr, team_members_off: 5 }], dayStr)).toBe(0)
  })
  it('absence hors du jour → capacité pleine', () => {
    expect(effectiveTeamSize(1, [{ start_date: '2026-02-01', end_date: '2026-02-05', team_members_off: 1 }], dayStr)).toBe(1)
  })
  it('bornes inclusives (premier et dernier jour de l’absence)', () => {
    const u = [{ start_date: '2026-01-15', end_date: '2026-01-16', team_members_off: 1 }]
    expect(effectiveTeamSize(1, u, '2026-01-15')).toBe(0)
    expect(effectiveTeamSize(1, u, '2026-01-16')).toBe(0)
    expect(effectiveTeamSize(1, u, '2026-01-17')).toBe(1)
  })
  it('team_members_off par défaut = 1 si absent', () => {
    expect(effectiveTeamSize(2, [{ start_date: dayStr, end_date: dayStr }], dayStr)).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('isSlotInWindows — créneaux optimisés', () => {
  const win = [{ start: iso(9, 0), end: iso(11, 0) }]
  it('créneau dans la fenêtre', () => expect(isSlotInWindows('10:00', date, win)).toBe(true))
  it('créneau hors fenêtre', () => expect(isSlotInWindows('12:00', date, win)).toBe(false))
  it('bornes inclusives', () => {
    expect(isSlotInWindows('09:00', date, win)).toBe(true)
    expect(isSlotInWindows('11:00', date, win)).toBe(true)
  })
  it('aucune fenêtre → false', () => expect(isSlotInWindows('10:00', date, [])).toBe(false))
})

// ─────────────────────────────────────────────────────────────────────────
describe('isSlotFeasible — temps de trajet entre RDV', () => {
  it('toujours faisable sans contrainte', () => {
    expect(isSlotFeasible('10:00', date, 60, [])).toBe(true)
  })
  it('RDV avant : faisable si le trajet rentre dans l’écart', () => {
    const before = { start: iso(9, 0), end: iso(9, 30), travelToNew: 600, travelFromNew: 0 } // 10 min, écart 30 min
    expect(isSlotFeasible('10:00', date, 60, [before])).toBe(true)
  })
  it('RDV avant : infaisable si le trajet dépasse l’écart', () => {
    const tight = { start: iso(9, 0), end: iso(9, 30), travelToNew: 3600, travelFromNew: 0 } // 60 min > 30 min
    expect(isSlotFeasible('10:00', date, 60, [tight])).toBe(false)
  })
  it('trajet pile égal à l’écart → faisable (<=)', () => {
    const exact = { start: iso(9, 0), end: iso(9, 30), travelToNew: 1800, travelFromNew: 0 } // 30 min == écart
    expect(isSlotFeasible('10:00', date, 60, [exact])).toBe(true)
  })
  it('RDV après : prend en compte le trajet depuis le nouveau client', () => {
    // nouveau 10:00→11:00, RDV après à 11:15 ; trajet 600s (10 min) → 11:00+10=11:10 <= 11:15 OK
    const okAfter = { start: iso(11, 15), end: iso(12, 0), travelToNew: 0, travelFromNew: 600 }
    expect(isSlotFeasible('10:00', date, 60, [okAfter])).toBe(true)
    // trajet 1200s (20 min) → 11:20 > 11:15 → infaisable
    const koAfter = { start: iso(11, 15), end: iso(12, 0), travelToNew: 0, travelFromNew: 1200 }
    expect(isSlotFeasible('10:00', date, 60, [koAfter])).toBe(false)
  })
  it('infaisable si un RDV chevauche directement', () => {
    const clash = { start: iso(10, 15), end: iso(10, 45), travelToNew: 0, travelFromNew: 0 }
    expect(isSlotFeasible('10:00', date, 60, [clash])).toBe(false)
  })
  it('RDV avant ET après (encadré) : faisable seulement si les deux trajets rentrent', () => {
    const around = [
      { start: iso(9, 0), end: iso(9, 30), travelToNew: 600, travelFromNew: 0 },   // avant, OK
      { start: iso(11, 30), end: iso(12, 0), travelToNew: 0, travelFromNew: 600 },  // après, OK
    ]
    expect(isSlotFeasible('10:00', date, 60, around)).toBe(true)
  })
})

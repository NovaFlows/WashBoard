// Logique de créneaux — fonctions pures, testables (voir slots.test.ts).
// Utilisée par StepSlot (réservation) et alignée avec le calendrier dashboard.

export const SLOT_STEP = 30 // minutes entre deux créneaux proposés

export type SlotBooking = { scheduled_at: string; durationMin: number }
export type TimeWindow = { start: string; end: string }
export type FeasibilityConstraint = { start: string; end: string; travelToNew: number; travelFromNew: number }

/** Génère les créneaux d'une plage [start,end], par pas de `step`, en gardant
 *  ceux dont la durée tient avant la fin. Format "HH:MM". */
export function generateSlots(start: string, end: string, durationMinutes: number, step: number = SLOT_STEP): string[] {
  const slots: string[] = []
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let current = sh * 60 + sm
  const endMinutes = eh * 60 + em
  while (current + durationMinutes <= endMinutes) {
    const h = Math.floor(current / 60).toString().padStart(2, '0')
    const m = (current % 60).toString().padStart(2, '0')
    slots.push(`${h}:${m}`)
    current += step
  }
  return slots
}

/** Plage [start,end[ d'un créneau local (ms epoch), sur une date donnée. */
function slotRange(slotTime: string, date: Date, durationMin: number): { start: number; end: number } {
  const [h, m] = slotTime.split(':').map(Number)
  const d = new Date(date)
  d.setHours(h, m, 0, 0)
  const start = d.getTime()
  return { start, end: start + durationMin * 60_000 }
}

/** Nombre de réservations qui chevauchent un créneau (pour comparer à la capacité). */
export function countOverlaps(slotTime: string, date: Date, durationMin: number, bookings: SlotBooking[]): number {
  const { start, end } = slotRange(slotTime, date, durationMin)
  return bookings.filter(b => {
    const bStart = new Date(b.scheduled_at).getTime()
    const bEnd = bStart + b.durationMin * 60_000
    return bStart < end && bEnd > start
  }).length
}

/** Vrai si le créneau tombe dans l'une des fenêtres « optimisées » (timezone-safe). */
export function isSlotInWindows(slotTime: string, date: Date, windows: TimeWindow[]): boolean {
  const { start } = slotRange(slotTime, date, 0)
  return windows.some(w => start >= new Date(w.start).getTime() && start <= new Date(w.end).getTime())
}

export type DayUnavailability = { start_date: string; end_date: string; team_members_off?: number | null }

/** Capacité effective un jour donné = nb de laveurs − absences couvrant ce jour. */
export function effectiveTeamSize(teamSize: number, unavailabilities: DayUnavailability[], dateStr: string): number {
  const u = unavailabilities.find(x => x.start_date <= dateStr && dateStr <= x.end_date)
  return u ? Math.max(0, teamSize - (u.team_members_off ?? 1)) : teamSize
}

export type BookingInterval = { startMs: number; durationMin: number }

/** Nombre de réservations existantes qui chevauchent l'intervalle [newStart,newEnd[.
 *  Sert à la vérification serveur anti-double-réservation. */
export function countConflicts(newStartMs: number, newEndMs: number, bookings: BookingInterval[]): number {
  return bookings.filter(b => {
    const bEnd = b.startMs + b.durationMin * 60_000
    return b.startMs < newEndMs && bEnd > newStartMs
  }).length
}

/** Vrai si le créneau est physiquement faisable vu les temps de trajet entre RDV. */
export function isSlotFeasible(slotTime: string, date: Date, durationMin: number, constraints: FeasibilityConstraint[]): boolean {
  if (constraints.length === 0) return true
  const { start: slotStart, end: slotEnd } = slotRange(slotTime, date, durationMin)
  return constraints.every(c => {
    const bStart = new Date(c.start).getTime()
    const bEnd = new Date(c.end).getTime()
    if (bEnd <= slotStart) return bEnd + c.travelToNew * 1000 <= slotStart   // RDV avant → trajet vers le nouveau
    if (bStart >= slotEnd) return slotEnd + c.travelFromNew * 1000 <= bStart  // RDV après → trajet depuis le nouveau
    return false // chevauchement direct
  })
}

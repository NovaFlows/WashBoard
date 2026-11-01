// Logique de créneaux — fonctions pures, testables (voir slots.test.ts).
// Utilisée par StepSlot (réservation) et alignée avec le calendrier dashboard.

import { instantParis } from './dateUtils'

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

/** Plage [start,end[ (ms epoch) d'un créneau. `date` porte le jour civil
 *  (année, mois, jour de l'appareil) ; l'heure est celle de Paris, comme les
 *  horaires du laveur et la vérification serveur (`creneauDansOuverture`). */
function slotRange(slotTime: string, date: Date, durationMin: number): { start: number; end: number } {
  const [h, m] = slotTime.split(':').map(Number)
  const start = instantParis(date.getFullYear(), date.getMonth() + 1, date.getDate(), h, m)
  return { start, end: start + durationMin * 60_000 }
}

/** `scheduled_at` à envoyer pour ce créneau, ce jour-là (ISO, UTC). */
export function debutCreneauIso(slotTime: string, date: Date): string {
  return new Date(slotRange(slotTime, date, 0).start).toISOString()
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

export type OpeningWindow = { start_time: string; end_time: string }

/** Vrai si aucune des plages d'ouverture données ne peut contenir une
 *  prestation de cette durée — distingue « la durée ne rentre nulle part »
 *  de « tout est déjà réservé », deux causes différentes du même message
 *  générique « Aucun créneau disponible ». Confondues jusqu'ici : une option
 *  de 30 min poussait une prestation de 3h à 3h30, au-delà de la seule plage
 *  17h-20h du laveur, sans que le client comprenne pourquoi (PistaClean,
 *  19/09/2026). */
export function dureeIncompatible(windows: OpeningWindow[], durationMinutes: number): boolean {
  if (windows.length === 0) return false
  return windows.every(w => generateSlots(w.start_time, w.end_time, durationMinutes).length === 0)
}

export type JourOuverture = OpeningWindow & { day_of_week: number }
export type JourDureeIncompatible = {
  day_of_week: number
  /** Vrai si même la durée SANS aucune option ne rentre déjà pas ce jour-là
   *  — plus grave que « seulement avec les options cochées ». */
  memeSansOptions: boolean
}

/** Comme `dureeIncompatible`, mais détaille QUELS jours posent problème —
 *  un laveur peut très bien avoir 3h le lundi et 8h le mardi : dire « ça ne
 *  rentre dans aucune de vos disponibilités » est faux dès que ça rentre le
 *  mardi, et inutile pour savoir quoi corriger. Un jour sans disponibilité
 *  configurée est ignoré (fermé, pas « trop long »). */
export function joursDureeIncompatible(
  availabilities: JourOuverture[],
  dureeBase: number,
  dureeAvecOptions: number,
): JourDureeIncompatible[] {
  const parJour = new Map<number, OpeningWindow[]>()
  for (const a of availabilities) {
    const liste = parJour.get(a.day_of_week) ?? []
    liste.push(a)
    parJour.set(a.day_of_week, liste)
  }

  const resultats: JourDureeIncompatible[] = []
  for (const [day, windows] of parJour) {
    if (dureeIncompatible(windows, dureeAvecOptions)) {
      resultats.push({ day_of_week: day, memeSansOptions: dureeIncompatible(windows, dureeBase) })
    }
  }
  return resultats.sort((a, b) => a.day_of_week - b.day_of_week)
}

/** Absence sur une ou plusieurs dates. Avec `start_time`/`end_time` (heure de
 *  Paris), elle ne bloque que cette plage, chaque jour de la période ; sans,
 *  toute la journée. Les heures sont absentes avant la migration. */
export type DayUnavailability = {
  start_date: string
  end_date: string
  team_members_off?: number | null
  start_time?: string | null
  end_time?: string | null
}

/** "08:00" ou "08:00:00" → minutes depuis minuit. */
export function minutesDepuisMinuit(heure: string): number {
  const [h, m] = heure.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function estJourneeEntiere(u: Pick<DayUnavailability, 'start_time' | 'end_time'>): boolean {
  return !u.start_time || !u.end_time
}

/** Absence sur toute la journée (point « congé » des calendriers) ; une plage horaire n'en est pas une. */
export function journeeBloquee(u: Pick<DayUnavailability, 'start_time' | 'end_time'> | null): boolean {
  return u !== null && estJourneeEntiere(u)
}

/** Laveurs disponibles ce jour-là. Sans `plage`, seule l'absence sur la
 *  journée entière compte (la première, comme l'agenda) ; avec `plage`
 *  ([début, fin[ en minutes, heure de Paris), s'y ajoutent les plages horaires
 *  qui la chevauchent : mieux vaut un créneau en moins qu'un rendez-vous de trop. */
export function capaciteDisponible(
  teamSize: number,
  unavailabilities: DayUnavailability[],
  dateStr: string,
  plage?: { debut: number; fin: number },
): number {
  const duJour = unavailabilities.filter(u => u.start_date <= dateStr && dateStr <= u.end_date)
  const journee = duJour.find(estJourneeEntiere)
  let absents = journee ? journee.team_members_off ?? 1 : 0
  if (plage) {
    for (const u of duJour) {
      if (estJourneeEntiere(u)) continue
      const debut = minutesDepuisMinuit(u.start_time!)
      const fin = minutesDepuisMinuit(u.end_time!)
      if (plage.debut < fin && plage.fin > debut) absents += u.team_members_off ?? 1
    }
  }
  return Math.max(0, teamSize - absents)
}

/** Capacité effective un jour donné = nb de laveurs − absences sur la journée entière. */
export function effectiveTeamSize(teamSize: number, unavailabilities: DayUnavailability[], dateStr: string): number {
  return capaciteDisponible(teamSize, unavailabilities, dateStr)
}

/** Capacité pendant un créneau "HH:MM" de `dureeMin` minutes. */
export function capaciteCreneau(
  teamSize: number,
  unavailabilities: DayUnavailability[],
  dateStr: string,
  slotTime: string,
  dureeMin: number,
): number {
  const debut = minutesDepuisMinuit(slotTime)
  return capaciteDisponible(teamSize, unavailabilities, dateStr, { debut, fin: debut + dureeMin })
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

/** Vrai si l'heure de ce créneau, sur cette date, est déjà passée.
 *
 *  Sert à la réservation le jour même : sans ce filtre, un client qui ouvre
 *  la page à 14h verrait encore des horaires du matin, pour un rendez-vous
 *  qu'il ne peut plus prendre. */
export function slotEstPasse(slotTime: string, date: Date, nowMs: number = Date.now()): boolean {
  return slotRange(slotTime, date, 0).start <= nowMs
}

export type BookingAvecAdresse = SlotBooking & { address: string }

/** Où se trouve le laveur MAINTENANT, pour estimer si le premier créneau du
 *  jour même est physiquement atteignable : à l'adresse de son dernier
 *  rendez-vous déjà terminé aujourd'hui, ou à son adresse de départ s'il n'a
 *  encore rien fait. `null` si aucune des deux n'est connue — dans ce cas,
 *  l'appelant ne peut pas vérifier le trajet et ne doit rien bloquer à
 *  l'aveugle (mieux vaut aucune contrainte qu'une contrainte inventée).
 *
 *  Ne regarde que les rendez-vous déjà TERMINÉS (fin <= maintenant) : un
 *  rendez-vous en cours ou à venir aujourd'hui est déjà une contrainte réelle
 *  dans `bookingConstraints`, avec la bonne adresse — le dupliquer ici avec
 *  l'adresse de départ serait faux. */
export function derniereLocalisation(
  bookingsAujourdhui: BookingAvecAdresse[],
  nowMs: number,
  baseAddress: string | null,
): { address: string } | null {
  const termines = bookingsAujourdhui
    .map(b => ({ address: b.address, fin: new Date(b.scheduled_at).getTime() + b.durationMin * 60_000 }))
    .filter(b => b.fin <= nowMs)
    .sort((a, b) => b.fin - a.fin)

  if (termines.length > 0) return { address: termines[0].address }
  if (baseAddress) return { address: baseAddress }
  return null
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

// Heures de début autorisées pour une prestation (demande du 2026-11-12) : un laveur qui veut
// regrouper ses lavages extérieurs à 8 h 30, 13 h ou 16 h ne propose que ces heures-là.
// Rangées dans `services.heures_debut` (text[] « HH:MM ») ; vide ou absent = toutes les heures
// que permettent les horaires du laveur, comme avant. Les horaires, congés et rendez-vous déjà
// pris continuent de s'appliquer : une heure autorisée mais occupée n'est pas proposée.

export const MAX_HEURES_DEBUT = 12
const FORMAT = /^([01]\d|2[0-3]):[0-5]\d$/

/** Heures proposées dans l'éditeur : toutes les demi-heures, de 06:00 à 21:30 (le pas des créneaux). */
export const HEURES_PROPOSEES: string[] = Array.from({ length: 32 }, (_, i) => {
  const minutes = 6 * 60 + i * 30
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
})

/** Liste lue en base ou reçue : heures valides, sans doublon, triées. `null` = pas de restriction. */
export function heuresDebutValides(brut: unknown): string[] | null {
  if (!Array.isArray(brut)) return null
  const heures = [...new Set(brut.filter((h): h is string => typeof h === 'string' && FORMAT.test(h)))].sort()
  return heures.length > 0 ? heures : null
}

/** Valeur reçue d'un client : exploitable si absente, nulle ou liste correcte. */
export function heuresDebutAcceptables(brut: unknown): boolean {
  if (brut === undefined || brut === null) return true
  return Array.isArray(brut) && brut.length <= MAX_HEURES_DEBUT && brut.every(h => typeof h === 'string' && FORMAT.test(h))
}

/** Ne garde, parmi les créneaux « HH:MM » d'une journée, que les heures autorisées. */
export function filtrerHeures(creneaux: string[], heures: string[] | null | undefined): string[] {
  const permises = heuresDebutValides(heures)
  return permises ? creneaux.filter(c => permises.includes(c)) : creneaux
}

/** Cette heure de début est-elle permise ? (sans restriction : toujours) */
export function heureAutorisee(heure: string, heures: string[] | null | undefined): boolean {
  const permises = heuresDebutValides(heures)
  return !permises || permises.includes(heure)
}

export function libelleHeure(h: string): string {
  const [hh, mm] = h.split(':')
  return mm === '00' ? `${Number(hh)} h` : `${Number(hh)} h ${mm}`
}

/** « 8 h 30 · 13 h · 16 h », ou « Toutes ». */
export function resumeHeures(heures: string[] | null | undefined): string {
  const permises = heuresDebutValides(heures)
  return permises ? permises.map(libelleHeure).join(' · ') : 'Toutes'
}

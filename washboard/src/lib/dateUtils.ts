/** YYYY-MM-DD in local timezone — use for date inputs and calendar keys. */
export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function getMondayOf(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  const day = r.getDay()
  r.setDate(r.getDate() - (day === 0 ? 6 : day - 1))
  return r
}

/** Heure au format court français (09:05, 14:30).
 *
 *  Était recopiée dans trois fichiers (calendrier, liste de RDV, liens de
 *  contact) sous le nom `fmt`. */
export function formatHeure(date: Date): string {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

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

/** Heure la plus courte possible : « 8h », « 8h30 », « 14h ».
 *
 *  Dans la vue Mois du calendrier, une case fait une cinquantaine de pixels de
 *  large sur un téléphone : « 08:00 » y était déjà tronqué en « 08:… », ce qui
 *  ne dit rien. En retirant le zéro de tête et les minutes rondes, on gagne
 *  assez de place pour que l'heure reste lisible. */
export function formatHeureCompacte(date: Date): string {
  const h = date.getHours()
  const m = date.getMinutes()
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

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

/** Fuseau de tous les rendez-vous.
 *
 *  Un rendez-vous est un fait à l'heure de Paris : le laveur travaille en
 *  France, ses horaires d'ouverture sont stockés en heure française. Mais une
 *  partie de l'affichage est calculée sur le SERVEUR — notifications, e-mails —
 *  et Vercel tourne en UTC. Sans fuseau explicite, un rendez-vous de 8 h s'y
 *  écrivait « 06:00 » l'été et « 07:00 » l'hiver.
 *
 *  Constaté le 2026-09-11 : un laveur a reçu « nouvelle réservation … à
 *  06:00 », hors de ses horaires, pour un rendez-vous correctement enregistré
 *  à 8 h. Les e-mails portaient la même erreur depuis mai.
 *
 *  Le fuseau est donc toujours fixé, jamais laissé à la machine. Dans le
 *  navigateur d'un laveur en France, cela ne change rien. */
export const FUSEAU = 'Europe/Paris'

/** Heure au format court français (09:05, 14:30), à l'heure de Paris.
 *
 *  Était recopiée dans trois fichiers (calendrier, liste de RDV, liens de
 *  contact) sous le nom `fmt`. */
export function formatHeure(date: Date): string {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: FUSEAU })
}

/** Heure la plus courte possible : « 8h », « 8h30 », « 14h ».
 *
 *  Dans la vue Mois du calendrier, une case fait une cinquantaine de pixels de
 *  large sur un téléphone : « 08:00 » y était déjà tronqué en « 08:… », ce qui
 *  ne dit rien. En retirant le zéro de tête et les minutes rondes, on gagne
 *  assez de place pour que l'heure reste lisible.
 *
 *  Tirée de `formatHeure` pour hériter de son fuseau : `getHours()` lisait
 *  l'heure de la machine, pas celle du rendez-vous. */
export function formatHeureCompacte(date: Date): string {
  const [, h, m] = /(\d{1,2})\D+(\d{2})/.exec(formatHeure(date)) ?? []
  const heures = Number(h)
  const minutes = Number(m)
  return minutes === 0 ? `${heures}h` : `${heures}h${String(minutes).padStart(2, '0')}`
}

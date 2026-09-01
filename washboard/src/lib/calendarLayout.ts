import { effectiveDuration, addonsDuration } from '@/lib/pricing'
export { formatHeure, formatHeureCompacte } from '@/lib/dateUtils'

// Calculs de disposition du calendrier, extraits de `CalendrierDashboard.tsx`
// (1594 lignes) où ils étaient noyés et non testés. Ce sont des fonctions
// pures : les sortir les rend vérifiables sans monter un composant React.

/** Le minimum dont la disposition a besoin d'un rendez-vous. Volontairement
 *  plus étroit que le `Booking` complet du composant : ces fonctions n'ont
 *  aucune raison de connaître le client, le prix ou l'adresse. */
export type LayoutBooking = {
  scheduled_at: string
  vehicle_count?: number | null
  selected_addons?: { duration_minutes?: number }[] | null
  services?: { duration_minutes: number } | null
}

/** Lundi de la semaine contenant `date`, à minuit. */
export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  d.setDate(d.getDate() - (d.getDay() + 6) % 7)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Grille du mois sur 6 semaines (42 cases), `null` pour les cases vides.
 *  Taille fixe : une grille qui change de hauteur d'un mois à l'autre fait
 *  sauter la mise en page. */
export function buildGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  const grid: (Date | null)[] = []
  const pad = (first.getDay() + 6) % 7 // lundi = première colonne
  for (let i = 0; i < pad; i++) grid.push(null)
  for (let d = 1; d <= last.getDate(); d++) grid.push(new Date(year, month, d))
  while (grid.length < 42) grid.push(null)
  return grid
}

/** Durée réelle d'un rendez-vous en millisecondes (options et véhicules
 *  multiples compris) — un lavage de 90 min pour 2 véhicules occupe 180 min. */
function dureeMs(b: LayoutBooking): number {
  const base = (b.services?.duration_minutes ?? 60) + addonsDuration(b.selected_addons)
  return effectiveDuration(base, b.vehicle_count) * 60_000
}

export type PlacedBooking<T extends LayoutBooking> = T & { col: number; totalCols: number }

/** Place les rendez-vous d'une journée en colonnes côte à côte quand ils se
 *  chevauchent (comme un agenda classique).
 *
 *  `col` est la colonne du rendez-vous, `totalCols` le nombre de colonnes à se
 *  partager la largeur à cet instant — calculé sur les rendez-vous réellement
 *  simultanés, pas sur la journée entière : sinon deux RDV qui se chevauchent
 *  le matin rétréciraient inutilement tous ceux de l'après-midi. */
export function layoutDayBookings<T extends LayoutBooking>(bookings: T[]): PlacedBooking<T>[] {
  if (bookings.length === 0) return []
  const debut = (b: LayoutBooking) => new Date(b.scheduled_at).getTime()
  const fin   = (b: LayoutBooking) => debut(b) + dureeMs(b)
  const tries = [...bookings].sort((a, b) => debut(a) - debut(b))

  // Fin d'occupation de chaque colonne : on réutilise la première colonne
  // libérée, sinon on en ouvre une nouvelle.
  const finDeColonne: number[] = []
  const avecColonne = tries.map(b => {
    const d = debut(b)
    let col = finDeColonne.findIndex(end => end <= d)
    if (col === -1) { col = finDeColonne.length; finDeColonne.push(fin(b)) }
    else finDeColonne[col] = fin(b)
    return { booking: b, col }
  })

  return avecColonne.map(({ booking, col }) => {
    const d = debut(booking), f = fin(booking)
    const simultanes = avecColonne.filter(({ booking: autre }) => debut(autre) < f && fin(autre) > d)
    const totalCols = Math.max(...simultanes.map(o => o.col)) + 1
    return { ...booking, col, totalCols }
  })
}

/** Deux dates tombent-elles le même jour (calendrier local) ? */
export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** Clé stable d'une journée, pour indexer sans risque de fuseau horaire. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}


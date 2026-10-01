// Filtre de distance de « Proposer ce créneau » (agenda de la PWA) : ne montrer que les
// clients qui habitent près du rendez-vous voisin du trou, à la distance choisie par le
// laveur (demande d'Alexandre, 2026-09-26).
//
// Distance À VOL D'OISEAU (`haversineKm`), pas un trajet routier : c'est un tri de
// proximité, pas un temps de route — l'écran le dit. La position d'un client est celle de
// sa réservation la plus récente qui en a une (les réservations saisies à la main sans
// adresse choisie dans la liste n'ont pas de coordonnées) ; un client sans position n'est
// jamais deviné, il est compté à part.

import { haversineKm } from '@/lib/geo'

export const DISTANCES_KM = [5, 10, 20, 30, 50] as const

export type Position = { lat: number; lng: number }

type ReservationPositionnee = {
  client_email: string
  scheduled_at: string
  lat: number | null
  lng: number | null
}

const cle = (email: string) => email.trim().toLowerCase()
const valide = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)

/** Position de chaque client (clé : email en minuscules) : sa réservation la plus récente
 *  qui a des coordonnées. */
export function positionsClients(reservations: ReservationPositionnee[]): Map<string, Position> {
  const dates = new Map<string, number>()
  const positions = new Map<string, Position>()
  for (const r of reservations) {
    if (!r.client_email?.trim() || !valide(r.lat) || !valide(r.lng)) continue
    const t = new Date(r.scheduled_at).getTime()
    if (!Number.isFinite(t)) continue
    const k = cle(r.client_email)
    if (dates.has(k) && (dates.get(k) as number) >= t) continue
    dates.set(k, t)
    positions.set(k, { lat: r.lat, lng: r.lng })
  }
  return positions
}

export type ClientProche<T> = { client: T; km: number }

/** Les clients à `maxKm` ou moins de `origine`, du plus proche au plus loin ; `sansPosition`
 *  compte ceux dont on ne connaît pas l'emplacement (ni proches, ni éloignés : inconnus). */
export function clientsProches<T extends { email: string }>(
  clients: T[],
  positions: Map<string, Position>,
  origine: Position,
  maxKm: number,
): { proches: ClientProche<T>[]; sansPosition: number } {
  const proches: ClientProche<T>[] = []
  let sansPosition = 0
  for (const client of clients) {
    const p = positions.get(cle(client.email))
    if (!p) { sansPosition++; continue }
    const km = haversineKm(origine.lat, origine.lng, p.lat, p.lng)
    if (km <= maxKm) proches.push({ client, km })
  }
  proches.sort((a, b) => a.km - b.km)
  return { proches, sansPosition }
}

/** « 4,2 km » sous 10 km, « 12 km » au-delà, « moins de 100 m » quand c'est la même adresse. */
export function libelleKm(km: number): string {
  if (km < 0.1) return 'moins de 100 m'
  return km < 10 ? `${km.toFixed(1).replace('.', ',')} km` : `${Math.round(km)} km`
}

type ReservationAdressee = { client_email: string; scheduled_at: string; address: string | null }

/** Adresse de chaque client (clé : email en minuscules) : celle de sa réservation la plus
 *  récente qui en a une. Sert à localiser les clients dont aucune réservation n'a de
 *  coordonnées (voir `hooks/usePositionsAdresses`). */
export function adressesClients(reservations: ReservationAdressee[]): Map<string, string> {
  const dates = new Map<string, number>()
  const adresses = new Map<string, string>()
  for (const r of reservations) {
    const adresse = r.address?.trim()
    if (!r.client_email?.trim() || !adresse) continue
    const t = new Date(r.scheduled_at).getTime()
    if (!Number.isFinite(t)) continue
    const k = cle(r.client_email)
    if (dates.has(k) && (dates.get(k) as number) >= t) continue
    dates.set(k, t)
    adresses.set(k, adresse)
  }
  return adresses
}

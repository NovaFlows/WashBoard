// Calculs des graphiques du CRM : sources de trafic, visites dans le temps,
// chiffre d'affaires cumulé, délai de réservation.
//
// Fonctions pures et testées : les composants ne font que dessiner. Les jours
// des événements de visite sont lus à l'heure de Paris — sans quoi une visite
// de 23 h 30 changerait de jour selon la machine qui fait le calcul.

import { normalizeHost } from './funnelStats'
import { FUSEAU, getMondayOf } from './dateUtils'
import { comptePourLeCA, effectivePrice, type RevenueBooking } from './crmStats'

type Evenement = { step: string; session_id: string; created_at: string; referrer_host?: string | null }

const JOUR_MS = 86_400_000

/** Jour d'un instant, à l'heure de Paris, au format AAAA-MM-JJ. */
export const jourParis = (d: string | number | Date): string =>
  new Date(d).toLocaleDateString('fr-CA', { timeZone: FUSEAU })

const dateLocale = (jour: string): Date => {
  const [a, m, j] = jour.split('-').map(Number)
  return new Date(a, m - 1, j)
}
const aaaammjj = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// ── Sources de trafic ───────────────────────────────────────────────────────

export type Reseau = { cle: string; label: string }

/** Réseau d'origine d'une visite, à partir du nom d'hôte du referrer.
 *
 *  Un même réseau arrive sous plusieurs noms : chez Kookii Clean, Instagram
 *  sous « instagram.com » et « l.instagram.com », TikTok sous « tiktok.com »
 *  et « www.tiktok.com », Google sous trois formes, dont l'application Android.
 *  Sans regroupement, un seul canal compte pour plusieurs sources. */
export function reseauDeHote(host: string | null | undefined, siteDuLaveur?: string): Reseau {
  if (!host || host === 'direct') return { cle: 'direct', label: 'Accès direct' }
  const h = normalizeHost(host)
  if (siteDuLaveur && h === siteDuLaveur) return { cle: 'site', label: 'Mon site web' }
  if (h.includes('instagram')) return { cle: 'instagram', label: 'Instagram' }
  if (h.includes('tiktok')) return { cle: 'tiktok', label: 'TikTok' }
  if (h.includes('facebook') || h === 'fb.com' || h.endsWith('.fb.com')) return { cle: 'facebook', label: 'Facebook' }
  if (h.includes('snapchat')) return { cle: 'snapchat', label: 'Snapchat' }
  if (h.includes('google')) return { cle: 'google', label: 'Google' }
  return { cle: h, label: h }
}

export type PointSource = Reseau & { visiteurs: number; conversions: number; taux: number }

/** Visiteurs et réservations par réseau. Une session compte une fois, avec la
 *  source de son premier événement — même règle que `buildReferrerBreakdown`.
 *  `taux` est en pourcentage, non arrondi : il sert à placer un point. */
export function sourcesVolumeConversion(evenements: Evenement[], siteDuLaveur?: string): PointSource[] {
  const reseauParSession = new Map<string, Reseau>()
  for (const e of evenements) {
    if (!reseauParSession.has(e.session_id)) reseauParSession.set(e.session_id, reseauDeHote(e.referrer_host, siteDuLaveur))
  }
  const convertis = new Set(evenements.filter(e => e.step === 'confirmation').map(e => e.session_id))

  const parReseau = new Map<string, PointSource>()
  for (const [session, reseau] of reseauParSession) {
    const point = parReseau.get(reseau.cle) ?? { ...reseau, visiteurs: 0, conversions: 0, taux: 0 }
    point.visiteurs++
    if (convertis.has(session)) point.conversions++
    parReseau.set(reseau.cle, point)
  }
  return [...parReseau.values()]
    .map(p => ({ ...p, taux: p.visiteurs ? (p.conversions / p.visiteurs) * 100 : 0 }))
    .sort((a, b) => b.visiteurs - a.visiteurs)
}

// ── Visites dans le temps ───────────────────────────────────────────────────

export type PointTrafic = { cle: string; label: string; visiteurs: number; conversions: number }

/** Visiteurs (sessions arrivées à « prestation ») et réservations (sessions
 *  arrivées à « confirmation »), par jour — ou par semaine au-delà de deux
 *  mois, sinon la courbe devient une brosse illisible.
 *
 *  Chaque jour de la plage a son point, même sans visite : une courbe qui
 *  saute les jours vides ment sur le rythme. */
export function traficDansLeTemps(
  evenements: Evenement[], debut: Date, fin: Date,
): { granularite: 'jour' | 'semaine'; points: PointTrafic[] } {
  const granularite = (fin.getTime() - debut.getTime()) / JOUR_MS > 62 ? 'semaine' : 'jour'
  const cleDuJour = (jour: string) => (granularite === 'semaine' ? aaaammjj(getMondayOf(dateLocale(jour))) : jour)

  const seaux = new Map<string, { visiteurs: Set<string>; conversions: Set<string> }>()
  for (let d = dateLocale(jourParis(debut)); d.getTime() < fin.getTime(); d.setDate(d.getDate() + 1)) {
    const cle = cleDuJour(aaaammjj(d))
    if (!seaux.has(cle)) seaux.set(cle, { visiteurs: new Set(), conversions: new Set() })
  }

  for (const e of evenements) {
    const seau = seaux.get(cleDuJour(jourParis(e.created_at)))
    if (!seau) continue
    if (e.step === 'prestation') seau.visiteurs.add(e.session_id)
    if (e.step === 'confirmation') seau.conversions.add(e.session_id)
  }

  const points = [...seaux.entries()].map(([cle, s]) => {
    const date = dateLocale(cle).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    return {
      cle,
      label: granularite === 'semaine' ? `sem. du ${date}` : date,
      visiteurs: s.visiteurs.size,
      conversions: s.conversions.size,
    }
  })
  return { granularite, points }
}

// ── Chiffre d'affaires cumulé ───────────────────────────────────────────────

export type PointCumul = { rang: number; label: string; actuel: number | null; precedent: number | null }
type Plage = { debut: Date; fin: Date }

/** Rang du jour (0 = premier jour) d'un instant dans une plage, en jours
 *  calendaires : l'arrondi absorbe l'heure gagnée ou perdue au changement
 *  d'heure. */
function rangDuJour(instant: number, debut: Date): number {
  const d = new Date(instant)
  return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - debut.getTime()) / JOUR_MS)
}

/** Chiffre d'affaires cumulé, jour après jour, face à la période précédente
 *  alignée sur le même rang — le 12 septembre face au 12 août.
 *
 *  Les jours encore à venir de la période en cours valent `null` : prolonger
 *  la courbe à plat jusqu'au bout du mois ferait croire à un arrêt net. */
export function caCumule(
  bookings: (RevenueBooking & { scheduled_at: string })[],
  periode: Plage,
  precedente: Plage,
  maintenant: number,
  etiquette: (rang: number, jour: Date) => string,
): PointCumul[] {
  const duree = (p: Plage) => Math.round((p.fin.getTime() - p.debut.getTime()) / JOUR_MS)
  const parJour = (p: Plage) => {
    const t = new Array<number>(duree(p)).fill(0)
    for (const b of bookings) {
      if (!comptePourLeCA(b)) continue
      const s = new Date(b.scheduled_at).getTime()
      if (!(s >= p.debut.getTime() && s < p.fin.getTime())) continue
      const rang = rangDuJour(s, p.debut)
      if (rang >= 0 && rang < t.length) t[rang] += effectivePrice(b)
    }
    return t
  }
  const actuel = parJour(periode)
  const avant = parJour(precedente)

  let cumulActuel = 0
  let cumulAvant = 0
  return Array.from({ length: Math.max(actuel.length, avant.length) }, (_, i) => {
    const jour = new Date(periode.debut)
    jour.setDate(periode.debut.getDate() + i)
    if (i < actuel.length) cumulActuel += actuel[i]
    if (i < avant.length) cumulAvant += avant[i]
    return {
      rang: i + 1,
      label: etiquette(i + 1, jour),
      actuel: i < actuel.length && jour.getTime() <= maintenant ? cumulActuel : null,
      precedent: i < avant.length ? cumulAvant : null,
    }
  })
}

// ── Délai de réservation ────────────────────────────────────────────────────

export type PointDelai = { creeLe: number; planifieLe: number; delai: number }

/** Combien de jours avant le rendez-vous les clients réservent. Les
 *  annulations sont écartées : elles ne disent rien de l'agenda réel. */
export function delaisDeReservation(
  bookings: { created_at: string; scheduled_at: string; status: string }[],
): { points: PointDelai[]; mediane: number | null } {
  const points = bookings
    .filter(b => b.status !== 'cancelled')
    .map(b => {
      const creeLe = new Date(b.created_at).getTime()
      const planifieLe = new Date(b.scheduled_at).getTime()
      return { creeLe, planifieLe, delai: Math.max(0, (planifieLe - creeLe) / JOUR_MS) }
    })
    .filter(p => Number.isFinite(p.creeLe) && Number.isFinite(p.planifieLe))

  const tries = points.map(p => p.delai).sort((a, b) => a - b)
  const n = tries.length
  const mediane = n === 0 ? null : n % 2 ? tries[(n - 1) / 2] : (tries[n / 2 - 1] + tries[n / 2]) / 2
  return { points, mediane }
}

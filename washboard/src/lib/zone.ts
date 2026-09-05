// Vérification « cette adresse est-elle dans la zone desservie ? »
//
// Cette logique ne vivait que dans la route `GET /api/zone/check`, appelée par
// le formulaire pendant la saisie. La création de réservation, elle, ne la
// consultait jamais : un appel direct à `POST /api/bookings` avec une adresse
// à 400 km faisait accepter le rendez-vous, et le laveur découvrait le trajet
// en ouvrant son agenda. Signalé par un audit externe le 2026-09-05.
//
// Extrait ici pour que la route publique ET la création de réservation
// appliquent la même règle, sans que la seconde ait à s'appeler elle-même par
// HTTP.

import { logger } from './logger'
import { getDeptCodeFromPostal } from './france-departments'
import { haversineKm } from './geo'
import type { ZoneConfig } from '@/types'

export type ZoneVerdict = {
  allowed: boolean
  distance_km?: number
  radius_km?: number
  department?: string
  department_name?: string
}

const AUTORISE: ZoneVerdict = { allowed: true }

// Une API cartographique qui ne répond pas ne doit pas figer la réservation.
const DELAI_MS = 8_000

async function getJson(url: string): Promise<Record<string, unknown>> {
  const r = await fetch(url, { signal: AbortSignal.timeout(DELAI_MS) })
  return await r.json()
}

/** Verdict de zone pour une adresse.
 *
 *  Choix produit assumé : en cas de doute — pas de clé API, adresse non
 *  reconnue, Google en panne — on LAISSE PASSER. Refuser un client légitime
 *  parce qu'un service tiers est tombé coûte plus cher qu'un rendez-vous hors
 *  zone que le laveur peut annuler. Chaque cas est tracé. */
export async function verdictZone(
  config: ZoneConfig | null | undefined,
  address: string,
  apiKey: string | null | undefined,
  contexte: Record<string, unknown> = {},
): Promise<ZoneVerdict> {
  if (!config?.enabled) return AUTORISE
  if (!address?.trim()) return AUTORISE

  try {
    if (config.type === 'road') {
      if (!apiKey) { logger.error('zone.check.no_api_key', contexte); return AUTORISE }
      const data = await getJson(
        `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(config.center_address)}&destinations=${encodeURIComponent(address)}&mode=driving&key=${apiKey}`,
      )
      const rows = data.rows as { elements?: { status?: string; distance?: { value: number } }[] }[] | undefined
      const el = rows?.[0]?.elements?.[0]
      if (el?.status !== 'OK' || !el.distance) return AUTORISE
      const distance_km = Math.round(el.distance.value / 1000)
      return { allowed: distance_km <= config.radius_km, distance_km, radius_km: config.radius_km }
    }

    if (config.type === 'crow') {
      if (!apiKey) { logger.error('zone.check.no_api_key', contexte); return AUTORISE }
      let centerLat = config.center_lat
      let centerLng = config.center_lng
      // Coordonnées absentes (géocodage raté à l'enregistrement) : on géocode ici.
      if (!centerLat || !centerLng) {
        const geo = await getJson(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(config.center_address)}&key=${apiKey}`,
        )
        const loc = (geo.results as { geometry?: { location?: { lat: number; lng: number } } }[] | undefined)?.[0]?.geometry?.location
        if (!loc) return AUTORISE
        centerLat = loc.lat
        centerLng = loc.lng
      }
      if (!centerLat || !centerLng) return AUTORISE

      const data = await getJson(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`,
      )
      const loc = (data.results as { geometry?: { location?: { lat: number; lng: number } } }[] | undefined)?.[0]?.geometry?.location
      if (!loc) return AUTORISE
      const distance_km = Math.round(haversineKm(centerLat, centerLng, loc.lat, loc.lng))
      return { allowed: distance_km <= config.radius_km, distance_km, radius_km: config.radius_km }
    }

    if (config.type === 'departments') {
      // Seul un code postal à 5 chiffres signale une adresse complète : sans
      // lui on ne peut rien conclure, et refuser serait arbitraire.
      const codePostal = /\b(\d{5})\b/.exec(address)
      if (!codePostal) return AUTORISE

      // API adresse du gouvernement : gratuite, sans clé, rend le département.
      const data = await getJson(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(address)}&limit=1`)
      const feature = (data.features as { properties?: { context?: string } }[] | undefined)?.[0]

      // Service indisponible ou adresse inconnue : on retombe sur le code
      // postal, qui suffit à déduire le département dans la quasi-totalité des
      // cas. Auparavant on laissait simplement passer, ce qui vidait la zone
      // « départements » de son sens dès que l'API gouvernementale toussait.
      const contextStr = feature?.properties?.context ?? ''
      const parts = contextStr.split(', ')
      const deptCode = parts[0]?.trim() || getDeptCodeFromPostal(codePostal[1])
      const deptName = parts[1]?.trim() ?? deptCode

      if (!deptCode) return AUTORISE
      return {
        allowed: config.departments.includes(deptCode),
        department: deptCode,
        department_name: deptName ?? undefined,
      }
    }
  } catch (e) {
    logger.error('zone.check.failed', { ...contexte, address }, e)
    return AUTORISE
  }

  return AUTORISE
}

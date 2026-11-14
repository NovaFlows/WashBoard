import { NextResponse } from 'next/server'
import { AppError, withErrorHandling } from '@/lib/apiError'
import { FUSEAU } from '@/lib/dateUtils'
import { fetchGoogleMaps } from '@/lib/googleMaps'
import { logger } from '@/lib/logger'
import { resumerPrevisions, type ReponseMet } from '@/lib/meteo'
import { cleanupRateLimit, rateLimit } from '@/lib/rateLimit'
import { createClient as createServerClient } from '@/lib/supabase/server'

// Météo de l'accueil du tableau de bord : une prévision pour l'endroit où travaille le laveur.
//
// Où : l'adresse de départ de son profil, sinon le centre de sa zone d'intervention, sinon Paris
// (le tableau de bord n'est pas bloqué pour autant : mieux vaut une météo approximative qu'un
// encart vide). La route n'écrit RIEN en base.
//
// Coûts : la position d'une adresse est demandée à Google une fois par adresse et par jour (cache
// mémoire), la prévision est gardée 30 min par position (arrondie à 2 décimales, ~1 km) : MET
// Norway demande de ne pas le solliciter inutilement.

const PARIS = { lat: 48.8566, lng: 2.3522 }
const TTL_POSITION_MS = 24 * 60 * 60 * 1000
const TTL_PREVISION_MS = 30 * 60 * 1000
const CACHE_MAX = 300
const LIMITE = 60
const FENETRE_MS = 10 * 60 * 1000

type Position = { lat: number; lng: number }
const positions = new Map<string, { valeur: Position | null; expire: number }>()
const previsions = new Map<string, { valeur: ReponseMet; expire: number }>()

function garder<T>(cache: Map<string, T>, cle: string, valeur: T) {
  if (!cache.has(cle) && cache.size >= CACHE_MAX) {
    const ancienne = cache.keys().next().value
    if (ancienne !== undefined) cache.delete(ancienne)
  }
  cache.set(cle, valeur)
}

async function positionDe(adresse: string): Promise<Position | null> {
  const cle = adresse.trim().toLowerCase().replace(/\s+/g, ' ')
  const connue = positions.get(cle)
  if (connue && Date.now() <= connue.expire) return connue.valeur

  const data = await fetchGoogleMaps<{ status?: string; results?: { geometry?: { location?: { lat?: number; lng?: number } } }[] }>(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(adresse)}&language=fr&region=fr`,
    'meteo.geocode',
  )
  if (!data) return null // panne : pas de cache
  const l = data.status === 'OK' ? data.results?.[0]?.geometry?.location : undefined
  const valeur = typeof l?.lat === 'number' && typeof l?.lng === 'number' ? { lat: l.lat, lng: l.lng } : null
  garder(positions, cle, { valeur, expire: Date.now() + TTL_POSITION_MS })
  return valeur
}

async function previsionDe(p: Position): Promise<ReponseMet | null> {
  const lat = p.lat.toFixed(2)
  const lng = p.lng.toFixed(2)
  const cle = `${lat},${lng}`
  const connue = previsions.get(cle)
  if (connue && Date.now() <= connue.expire) return connue.valeur
  try {
    const res = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lng}`, {
      // MET Norway exige un agent qui identifie l'application et un moyen de la joindre (ici le site).
      headers: { 'User-Agent': 'WashBoard/1.0 https://www.washboard.fr' },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) {
      logger.warn('meteo.met_status', { status: res.status })
      return null
    }
    const valeur = (await res.json()) as ReponseMet
    garder(previsions, cle, { valeur, expire: Date.now() + TTL_PREVISION_MS })
    return valeur
  } catch (e) {
    logger.warn('meteo.met_failed', {}, e)
    return null
  }
}

const heureParis = new Intl.DateTimeFormat('en-GB', { timeZone: FUSEAU, hour: '2-digit', hourCycle: 'h23' })

export const GET = withErrorHandling('meteo.get', async () => {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new AppError('Non autorisé', { status: 401 })

  cleanupRateLimit()
  const verdict = rateLimit(`meteo:${user.id}`, LIMITE, FENETRE_MS)
  if (!verdict.ok) {
    return NextResponse.json({ error: 'Trop de requêtes en peu de temps.' }, { status: 429, headers: { 'Retry-After': String(verdict.retryAfter) } })
  }

  const { data: washer } = await supabase.from('washers').select('base_address, zone_config').eq('user_id', user.id).single()

  let position: Position | null = null
  const zone = washer?.zone_config as { enabled?: boolean; center_lat?: number; center_lng?: number; center_address?: string } | null
  if (washer?.base_address?.trim()) position = await positionDe(washer.base_address)
  if (!position && zone?.enabled && typeof zone.center_lat === 'number' && typeof zone.center_lng === 'number') position = { lat: zone.center_lat, lng: zone.center_lng }
  if (!position && zone?.enabled && zone.center_address?.trim()) position = await positionDe(zone.center_address)
  const approximative = position === null
  const lieu = position ?? PARIS

  const reponse = await previsionDe(lieu)
  const meteo = resumerPrevisions(reponse, Date.now(), iso => Number(heureParis.format(new Date(iso))))
  if (!meteo) return NextResponse.json({ meteo: null })

  return NextResponse.json({ meteo, approximative }, { headers: { 'Cache-Control': 'private, max-age=600' } })
})

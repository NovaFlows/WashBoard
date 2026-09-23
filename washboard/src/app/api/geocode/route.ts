import { NextResponse } from 'next/server'
import { AppError, withErrorHandling } from '@/lib/apiError'
import { fetchGoogleMaps } from '@/lib/googleMaps'
import { logger } from '@/lib/logger'
import { cleanupRateLimit, rateLimit } from '@/lib/rateLimit'
import { createClient as createServerClient } from '@/lib/supabase/server'

// Géocodage d'une adresse pour l'agenda : les rendez-vous saisis à la main sans
// choisir la suggestion d'autocomplétion n'ont ni `lat` ni `lng`, et l'agenda ne
// peut alors pas afficher le trajet entre deux rendez-vous.
//
// Chaque appel Google est facturé. D'où : session obligatoire, cache mémoire, et
// un plafond par laveur. La route n'écrit RIEN en base : le client complète
// l'affichage, il ne corrige pas la donnée.

const ADRESSE_MAX = 200

// Un agenda peut compter quelques dizaines d'adresses à compléter au premier
// affichage ; le client n'en redemande jamais deux fois la même. 60 par tranche
// de dix minutes couvre ce premier passage et coûte au pire ~0,30 $ par laveur
// et par tranche — contre des milliers d'appels pour un script.
const GEOCODE_LIMITE = 60
const GEOCODE_FENETRE_MS = 10 * 60 * 1000

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CACHE_TAILLE_MAX = 500

type Coordonnees = { lat: number; lng: number } | null

// Un « introuvable » est mis en cache aussi (sinon une adresse fantaisiste
// serait re-facturée à chaque appel), mais jamais une panne Google : elle doit
// pouvoir se rétablir dès que Google répond de nouveau.
const cache = new Map<string, { valeur: Coordonnees; expire: number }>()

type ReponseGeocode = {
  status?: string
  error_message?: string
  results?: { geometry?: { location?: { lat: number; lng: number } } }[]
}

function cleCache(adresse: string): string {
  return adresse.trim().toLowerCase().replace(/\s+/g, ' ')
}

function lireCache(cle: string): { valeur: Coordonnees } | null {
  const entree = cache.get(cle)
  if (!entree) return null
  if (Date.now() > entree.expire) {
    cache.delete(cle)
    return null
  }
  return { valeur: entree.valeur }
}

function ecrireCache(cle: string, valeur: Coordonnees) {
  // Borne la mémoire : la Map garde l'ordre d'insertion, la première clé est la
  // plus ancienne.
  if (!cache.has(cle) && cache.size >= CACHE_TAILLE_MAX) {
    const plusAncienne = cache.keys().next().value
    if (plusAncienne !== undefined) cache.delete(plusAncienne)
  }
  cache.set(cle, { valeur, expire: Date.now() + CACHE_TTL_MS })
}

const INTROUVABLE = { lat: null, lng: null }

export const GET = withErrorHandling('geocode.get', async (req: Request) => {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new AppError('Non autorisé', { status: 401 })

  const adresse = new URL(req.url).searchParams.get('address')?.trim() ?? ''
  if (!adresse) throw new AppError('Adresse manquante', { status: 400 })
  if (adresse.length > ADRESSE_MAX) {
    throw new AppError('Adresse trop longue', { status: 400, publicMessage: `Adresse trop longue (${ADRESSE_MAX} caractères maximum).` })
  }

  const cle = cleCache(adresse)
  const enCache = lireCache(cle)
  if (enCache) return NextResponse.json(enCache.valeur ?? INTROUVABLE)

  // Seuls les appels qui atteignent Google comptent dans le plafond : servir le
  // cache ne coûte rien.
  cleanupRateLimit()
  const verdict = rateLimit(`geocode:${user.id}`, GEOCODE_LIMITE, GEOCODE_FENETRE_MS)
  if (!verdict.ok) {
    logger.warn('geocode.rate_limited', { userId: user.id })
    return NextResponse.json(
      { error: 'Trop de requêtes en peu de temps. Réessayez dans quelques minutes.' },
      { status: 429, headers: { 'Retry-After': String(verdict.retryAfter) } },
    )
  }

  const data = await fetchGoogleMaps<ReponseGeocode>(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(adresse)}&language=fr&region=fr`,
    'geocode',
  )
  // Panne (déjà tracée par fetchGoogleMaps) : réponse « introuvable », sans cache.
  if (!data) return NextResponse.json(INTROUVABLE)

  const loc = data.results?.[0]?.geometry?.location
  const valeur: Coordonnees = loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)
    ? { lat: loc.lat, lng: loc.lng }
    : null
  ecrireCache(cle, valeur)
  return NextResponse.json(valeur ?? INTROUVABLE)
})

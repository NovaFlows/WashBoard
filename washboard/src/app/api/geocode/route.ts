import { NextResponse } from 'next/server'
import { AppError, withErrorHandling } from '@/lib/apiError'
import { fetchGoogleMaps } from '@/lib/googleMaps'
import { logger } from '@/lib/logger'
import { cleanupRateLimit, rateLimit } from '@/lib/rateLimit'
import { createClient as createServerClient } from '@/lib/supabase/server'

// Position (latitude, longitude) d'une adresse, pour le filtre de distance de « Proposer ce
// créneau » (agenda de la PWA) : les réservations prises sur la page publique n'enregistrent
// pas de coordonnées, il faut donc les retrouver à partir de l'adresse.
//
// Chaque appel Google est facturé. D'où : session obligatoire, cache mémoire, plafond par
// laveur (plus large que `/api/trajet` : un carnet de clients se localise d'un coup, mais le
// navigateur retient les résultats et ne redemande jamais deux fois la même adresse). La route
// n'écrit RIEN en base.

const ADRESSE_MAX = 200
const GEOCODE_LIMITE = 150
const GEOCODE_FENETRE_MS = 10 * 60 * 1000
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CACHE_TAILLE_MAX = 500

type Position = { lat: number; lng: number } | null

// Un « introuvable » est mis en cache aussi (une adresse fantaisiste ne doit pas être
// refacturée à chaque appel), jamais une panne Google.
const cache = new Map<string, { valeur: Position; expire: number }>()

type ReponseGeocode = {
  status?: string
  results?: { geometry?: { location?: { lat?: number; lng?: number } } }[]
}

const normaliser = (adresse: string) => adresse.trim().toLowerCase().replace(/\s+/g, ' ')
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

  const cle = normaliser(adresse)
  const entree = cache.get(cle)
  if (entree && Date.now() <= entree.expire) return NextResponse.json(entree.valeur ?? INTROUVABLE)
  if (entree) cache.delete(cle)

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
  // Panne (déjà tracée par fetchGoogleMaps) : « introuvable », sans cache.
  if (!data) return NextResponse.json(INTROUVABLE)

  const lieu = data.status === 'OK' ? data.results?.[0]?.geometry?.location : undefined
  const valeur: Position = typeof lieu?.lat === 'number' && Number.isFinite(lieu.lat) && typeof lieu?.lng === 'number' && Number.isFinite(lieu.lng)
    ? { lat: lieu.lat, lng: lieu.lng }
    : null

  if (!cache.has(cle) && cache.size >= CACHE_TAILLE_MAX) {
    const plusAncienne = cache.keys().next().value
    if (plusAncienne !== undefined) cache.delete(plusAncienne)
  }
  cache.set(cle, { valeur, expire: Date.now() + CACHE_TTL_MS })
  return NextResponse.json(valeur ?? INTROUVABLE)
})

import { NextResponse } from 'next/server'
import { AppError, withErrorHandling } from '@/lib/apiError'
import { fetchGoogleMaps } from '@/lib/googleMaps'
import { logger } from '@/lib/logger'
import { cleanupRateLimit, rateLimit } from '@/lib/rateLimit'
import { createClient as createServerClient } from '@/lib/supabase/server'

// Trajet en voiture entre deux adresses, pour l'agenda (« ~X min de route »).
// Google Distance Matrix accepte des adresses en texte : les rendez-vous saisis
// à la main sans lat/lng fonctionnent comme les autres.
//
// Chaque appel Google est facturé. D'où : session obligatoire, cache mémoire, et
// un plafond par laveur. La route n'écrit RIEN en base.

const ADRESSE_MAX = 200

// Un agenda chargé compte une dizaine de trajets par jour ; le client n'en
// redemande jamais deux fois le même. 60 par tranche de dix minutes couvre
// plusieurs jours feuilletés d'affilée et borne le coût d'un script.
const TRAJET_LIMITE = 60
const TRAJET_FENETRE_MS = 10 * 60 * 1000

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CACHE_TAILLE_MAX = 500

type Trajet = { minutes: number; km: number } | null

// Un « introuvable » est mis en cache aussi (sinon une adresse fantaisiste
// serait re-facturée à chaque appel), mais jamais une panne Google : elle doit
// pouvoir se rétablir dès que Google répond de nouveau.
const cache = new Map<string, { valeur: Trajet; expire: number }>()

type ReponseDistanceMatrix = {
  status?: string
  error_message?: string
  rows?: {
    elements?: {
      status?: string
      duration?: { value?: number }
      distance?: { value?: number }
    }[]
  }[]
}

const normaliser = (adresse: string) => adresse.trim().toLowerCase().replace(/\s+/g, ' ')

// Le sens compte (sens uniques, bretelles) : A>B et B>A sont deux clés.
const cleCache = (from: string, to: string) => `${normaliser(from)}>${normaliser(to)}`

function lireCache(cle: string): { valeur: Trajet } | null {
  const entree = cache.get(cle)
  if (!entree) return null
  if (Date.now() > entree.expire) {
    cache.delete(cle)
    return null
  }
  return { valeur: entree.valeur }
}

function ecrireCache(cle: string, valeur: Trajet) {
  // Borne la mémoire : la Map garde l'ordre d'insertion, la première clé est la
  // plus ancienne.
  if (!cache.has(cle) && cache.size >= CACHE_TAILLE_MAX) {
    const plusAncienne = cache.keys().next().value
    if (plusAncienne !== undefined) cache.delete(plusAncienne)
  }
  cache.set(cle, { valeur, expire: Date.now() + CACHE_TTL_MS })
}

const INTROUVABLE = { minutes: null, km: null }

function lireAdresse(params: URLSearchParams, nom: string, libelle: string): string {
  const valeur = params.get(nom)?.trim() ?? ''
  if (!valeur) throw new AppError(`${libelle} manquante`, { status: 400 })
  if (valeur.length > ADRESSE_MAX) {
    throw new AppError(`${libelle} trop longue`, { status: 400, publicMessage: `${libelle} trop longue (${ADRESSE_MAX} caractères maximum).` })
  }
  return valeur
}

export const GET = withErrorHandling('trajet.get', async (req: Request) => {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new AppError('Non autorisé', { status: 401 })

  const params = new URL(req.url).searchParams
  const from = lireAdresse(params, 'from', 'Adresse de départ')
  const to = lireAdresse(params, 'to', 'Adresse d’arrivée')

  const cle = cleCache(from, to)
  const enCache = lireCache(cle)
  if (enCache) return NextResponse.json(enCache.valeur ?? INTROUVABLE)

  // Seuls les appels qui atteignent Google comptent dans le plafond : servir le
  // cache ne coûte rien.
  cleanupRateLimit()
  const verdict = rateLimit(`trajet:${user.id}`, TRAJET_LIMITE, TRAJET_FENETRE_MS)
  if (!verdict.ok) {
    logger.warn('trajet.rate_limited', { userId: user.id })
    return NextResponse.json(
      { error: 'Trop de requêtes en peu de temps. Réessayez dans quelques minutes.' },
      { status: 429, headers: { 'Retry-After': String(verdict.retryAfter) } },
    )
  }

  const data = await fetchGoogleMaps<ReponseDistanceMatrix>(
    `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(from)}&destinations=${encodeURIComponent(to)}&mode=driving&language=fr&region=fr`,
    'trajet',
  )
  // Panne (déjà tracée par fetchGoogleMaps) : réponse « introuvable », sans cache.
  if (!data) return NextResponse.json(INTROUVABLE)

  const element = data.rows?.[0]?.elements?.[0]
  const secondes = element?.duration?.value
  const metres = element?.distance?.value
  const valeur: Trajet = element?.status === 'OK'
    && typeof secondes === 'number' && Number.isFinite(secondes)
    && typeof metres === 'number' && Number.isFinite(metres)
    ? { minutes: Math.round(secondes / 60), km: Math.round(metres / 100) / 10 }
    : null
  ecrireCache(cle, valeur)
  return NextResponse.json(valeur ?? INTROUVABLE)
})

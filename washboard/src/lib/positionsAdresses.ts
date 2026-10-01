// Position d'une adresse (latitude, longitude), demandée à `/api/geocode` et RETENUE dans le
// navigateur : une adresse ne change pas de place, la redemander à chaque ouverture ferait
// payer Google pour rien. Sert au filtre de distance de « Proposer ce créneau ».
//
// Deux niveaux : la mémoire de la page, et `localStorage` (par appareil, jamais nécessaire :
// s'il est absent ou plein, on repart de la mémoire). Une adresse que Google ne trouve pas est
// retenue comme « introuvable » (`null`) ; un échec de la route (réseau, plafond, panne) ne
// l'est JAMAIS : il pourra être retenté.

import type { Position } from '@/lib/proposerCreneau'

const CLE_STOCKAGE = 'wb-geocode-v1'
const MAX_RETENUES = 400

type Retenue = [number, number] | null

const memoire = new Map<string, Retenue>()
const enCours = new Map<string, Promise<Position | null | undefined>>()
let stockageLu = false
let pauseJusqua = 0

export const cleAdresse = (adresse: string) => adresse.trim().toLowerCase().replace(/\s+/g, ' ')

function lireStockage() {
  if (stockageLu) return
  stockageLu = true
  try {
    const brut = window.localStorage.getItem(CLE_STOCKAGE)
    if (!brut) return
    const donnees = JSON.parse(brut) as Record<string, unknown>
    for (const [k, v] of Object.entries(donnees)) {
      if (v === null) memoire.set(k, null)
      else if (Array.isArray(v) && v.length === 2 && v.every(n => typeof n === 'number' && Number.isFinite(n))) memoire.set(k, [v[0], v[1]])
    }
  } catch { /* stockage absent ou illisible : on repart de la mémoire */ }
}

function ecrireStockage() {
  try {
    // Ordre d'insertion : on garde les plus récentes, à la fin.
    const entrees = Array.from(memoire.entries()).slice(-MAX_RETENUES)
    window.localStorage.setItem(CLE_STOCKAGE, JSON.stringify(Object.fromEntries(entrees)))
  } catch { /* plein ou refusé : la mémoire de la page suffit */ }
}

/** `undefined` : jamais demandée (ou échec à retenter) ; `null` : Google ne la trouve pas. */
export function positionConnue(adresse: string): Position | null | undefined {
  lireStockage()
  const r = memoire.get(cleAdresse(adresse))
  if (r === undefined) return undefined
  return r === null ? null : { lat: r[0], lng: r[1] }
}

/** Demande la position d'une adresse (une seule requête, même demandée deux fois en même
 *  temps). Rend `undefined` quand la route n'a pas pu répondre : rien n'est retenu. */
export async function localiser(adresse: string): Promise<Position | null | undefined> {
  const connue = positionConnue(adresse)
  if (connue !== undefined) return connue
  if (Date.now() < pauseJusqua) return undefined

  const cle = cleAdresse(adresse)
  const deja = enCours.get(cle)
  if (deja) return deja

  const demande = (async (): Promise<Position | null | undefined> => {
    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(adresse.trim())}`)
      if (res.status === 429) {
        const attente = Number(res.headers.get('Retry-After'))
        pauseJusqua = Date.now() + (Number.isFinite(attente) && attente > 0 ? attente : 600) * 1000
        return undefined
      }
      if (!res.ok) return undefined
      const json = (await res.json()) as { lat: number | null; lng: number | null }
      if (typeof json.lat === 'number' && typeof json.lng === 'number') {
        memoire.set(cle, [json.lat, json.lng])
        ecrireStockage()
        return { lat: json.lat, lng: json.lng }
      }
      memoire.set(cle, null)
      ecrireStockage()
      return null
    } catch {
      return undefined
    } finally {
      enCours.delete(cle)
    }
  })()
  enCours.set(cle, demande)
  return demande
}

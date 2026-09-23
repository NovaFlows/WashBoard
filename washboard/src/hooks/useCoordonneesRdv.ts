'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Booking } from '@/components/dashboard/CalendrierDashboardV1'

type Coordonnees = { lat: number; lng: number }

const ADRESSE_MAX = 200
const PARALLELE_MAX = 2

// Niveau module : une adresse n'est jamais redemandée pendant la session, même si
// l'écran est démonté puis remonté. On garde la promesse (et non le résultat) pour
// que deux appels simultanés sur la même adresse partagent une seule requête.
// Un échec est retenu comme « introuvable » : chaque appel coûte de l'argent côté
// Google, mieux vaut un trajet absent qu'une boucle de requêtes.
const demandes = new Map<string, Promise<Coordonnees | null>>()
const trouvees = new Map<string, Coordonnees>()

// Renseigné quand la route répond 429 : on n'insiste pas avant l'heure indiquée.
let pauseJusqua = 0

const cle = (adresse: string) => adresse.trim().toLowerCase().replace(/\s+/g, ' ')

function aCompleter(b: Booking): boolean {
  if (b.status === 'cancelled') return false
  if (b.lat != null && b.lng != null) return false
  const a = b.address?.trim()
  return !!a && a.length <= ADRESSE_MAX
}

async function geocoder(adresse: string): Promise<Coordonnees | null> {
  try {
    const res = await fetch(`/api/geocode?address=${encodeURIComponent(adresse.trim())}`)
    if (res.status === 429) {
      const attente = Number(res.headers.get('Retry-After'))
      pauseJusqua = Date.now() + (Number.isFinite(attente) && attente > 0 ? attente : 600) * 1000
      return null
    }
    if (!res.ok) return null
    const json = (await res.json()) as { lat: number | null; lng: number | null }
    return typeof json.lat === 'number' && typeof json.lng === 'number' ? { lat: json.lat, lng: json.lng } : null
  } catch {
    // Volontairement muet : l'agenda fonctionne sans le trajet, et la panne
    // Google éventuelle est déjà tracée côté serveur par `fetchGoogleMaps`.
    return null
  }
}

/**
 * Complète les `lat`/`lng` manquants des rendez-vous en géocodant leur adresse
 * via `/api/geocode`, pour que l'agenda puisse afficher le trajet entre deux
 * rendez-vous. Rien n'est écrit en base : seule la liste renvoyée est enrichie.
 *
 * Les rendez-vous annulés ne sont pas géocodés. Si la route échoue ou ne trouve
 * rien, le rendez-vous reste tel quel, sans erreur affichée.
 */
export function useCoordonneesRdv(bookings: Booking[]): Booking[] {
  // Copie locale du cache module : c'est elle qui relance le rendu quand une
  // adresse vient d'être résolue.
  const [resolues, setResolues] = useState(() => new Map(trouvees))

  // Distinct de `actif` (plus bas), qui s'éteint aussi quand la liste des
  // rendez-vous change : une requête déjà partie doit alors rafraîchir l'écran,
  // sauf si celui-ci a été démonté.
  const monte = useRef(false)
  useEffect(() => {
    monte.current = true
    return () => { monte.current = false }
  }, [])

  // Chaîne plutôt que tableau : l'effet ne se relance que si l'ensemble des
  // adresses change, pas à chaque nouvelle identité de `bookings`.
  const signature = useMemo(() => {
    const vues = new Set<string>()
    const liste: string[] = []
    for (const b of bookings) {
      if (!aCompleter(b)) continue
      const k = cle(b.address)
      if (vues.has(k)) continue
      vues.add(k)
      liste.push(b.address.trim())
    }
    return JSON.stringify(liste)
  }, [bookings])

  useEffect(() => {
    if (signature === '[]') return
    let actif = true
    const file: string[] = JSON.parse(signature)

    async function ouvrier() {
      while (actif && file.length > 0) {
        const adresse = file.shift()
        if (adresse === undefined) return
        const k = cle(adresse)
        // Déjà demandée (par un rendu précédent ou une autre instance) : on
        // rejoint la même requête, on n'en lance pas une seconde.
        let promesse = demandes.get(k)
        if (!promesse) {
          if (Date.now() < pauseJusqua) continue
          promesse = geocoder(adresse)
          demandes.set(k, promesse)
        }
        const coord = await promesse
        if (coord) trouvees.set(k, coord)
        // Refusée par le plafond (429), pas traitée : elle pourra être redemandée
        // une fois la pause écoulée.
        else if (Date.now() < pauseJusqua) demandes.delete(k)
        // Réponse tardive après démontage : on ne touche plus à l'état.
        if (coord && monte.current) setResolues(prev => (prev.has(k) ? prev : new Map(prev).set(k, coord)))
      }
    }

    for (let i = 0; i < PARALLELE_MAX; i++) void ouvrier()
    return () => { actif = false }
  }, [signature])

  return useMemo(() => {
    if (resolues.size === 0) return bookings
    let modifie = false
    const complete = bookings.map(b => {
      if ((b.lat != null && b.lng != null) || !b.address) return b
      const c = resolues.get(cle(b.address))
      if (!c) return b
      modifie = true
      return { ...b, lat: c.lat, lng: c.lng }
    })
    return modifie ? complete : bookings
  }, [bookings, resolues])
}

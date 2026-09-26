'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Booking } from '@/components/dashboard/CalendrierDashboardV1'

type Trajet = { minutes: number; km: number }

const ADRESSE_MAX = 200
const PARALLELE_MAX = 2

// Niveau module : une paire d'adresses n'est jamais redemandée pendant la
// session, même si l'écran est démonté puis remonté. On garde la promesse (et non
// le résultat) pour que deux appels simultanés sur la même paire partagent une
// seule requête. Un échec est retenu comme « introuvable » : chaque appel coûte
// de l'argent côté Google, mieux vaut un trajet absent qu'une boucle de requêtes.
const demandes = new Map<string, Promise<Trajet | null>>()
const trouves = new Map<string, Trajet>()

// Renseigné quand la route répond 429 : on n'insiste pas avant l'heure indiquée.
let pauseJusqua = 0

const normaliser = (adresse: string) => adresse.trim().toLowerCase().replace(/\s+/g, ' ')
const clePaire = (from: string, to: string) => `${normaliser(from)}>${normaliser(to)}`

type Paire = { id: string; from: string; to: string }

async function demanderTrajet(from: string, to: string): Promise<Trajet | null> {
  try {
    const res = await fetch(`/api/trajet?from=${encodeURIComponent(from.trim())}&to=${encodeURIComponent(to.trim())}`)
    if (res.status === 429) {
      const attente = Number(res.headers.get('Retry-After'))
      pauseJusqua = Date.now() + (Number.isFinite(attente) && attente > 0 ? attente : 600) * 1000
      return null
    }
    if (!res.ok) return null
    const json = (await res.json()) as { minutes: number | null; km: number | null }
    return typeof json.minutes === 'number' && typeof json.km === 'number' ? { minutes: json.minutes, km: json.km } : null
  } catch {
    // Volontairement muet : l'agenda fonctionne sans le trajet, et la panne
    // Google éventuelle est déjà tracée côté serveur par `fetchGoogleMaps`.
    return null
  }
}

/**
 * Temps et distance de route en voiture entre chaque paire de rendez-vous
 * consécutifs, via `/api/trajet` (Google Distance Matrix). Rien n'est écrit en
 * base.
 *
 * `rdvs` : les rendez-vous d'un seul jour, déjà triés par heure et sans les
 * annulés. Une paire n'est demandée que si les deux adresses sont renseignées ;
 * moins de deux rendez-vous, aucune requête. Renvoie une Map dont la clé est
 * `${idA}>${idB}` ; une paire absente n'a pas (encore) de trajet — la route a
 * échoué, ne trouve rien ou refuse (plafond) : aucune erreur n'est affichée.
 */
export function useTrajetsRdv(rdvs: Booking[]): Map<string, Trajet> {
  // Copie locale du cache module : c'est elle qui relance le rendu quand un
  // trajet vient d'arriver.
  const [resolus, setResolus] = useState(() => new Map(trouves))

  // Distinct de `actif` (plus bas), qui s'éteint aussi quand la liste des
  // rendez-vous change : une requête déjà partie doit alors rafraîchir l'écran,
  // sauf si celui-ci a été démonté.
  const monte = useRef(false)
  useEffect(() => {
    monte.current = true
    return () => { monte.current = false }
  }, [])

  const paires = useMemo(() => {
    const liste: Paire[] = []
    for (let i = 0; i < rdvs.length - 1; i++) {
      const from = rdvs[i].address?.trim()
      const to = rdvs[i + 1].address?.trim()
      if (!from || !to || from.length > ADRESSE_MAX || to.length > ADRESSE_MAX) continue
      liste.push({ id: `${rdvs[i].id}>${rdvs[i + 1].id}`, from, to })
    }
    return liste
  }, [rdvs])

  // Chaîne plutôt que tableau : l'effet ne se relance que si l'ensemble des
  // paires d'adresses change, pas à chaque nouvelle identité de `rdvs`.
  const signature = useMemo(() => {
    const vues = new Set<string>()
    const liste: [string, string][] = []
    for (const p of paires) {
      const k = clePaire(p.from, p.to)
      if (vues.has(k)) continue
      vues.add(k)
      liste.push([p.from, p.to])
    }
    return JSON.stringify(liste)
  }, [paires])

  useEffect(() => {
    if (signature === '[]') return
    let actif = true
    const file: [string, string][] = JSON.parse(signature)

    async function ouvrier() {
      while (actif && file.length > 0) {
        const paire = file.shift()
        if (paire === undefined) return
        const [from, to] = paire
        const k = clePaire(from, to)
        // Déjà demandée (par un rendu précédent ou une autre instance) : on
        // rejoint la même requête, on n'en lance pas une seconde.
        let promesse = demandes.get(k)
        if (!promesse) {
          if (Date.now() < pauseJusqua) continue
          promesse = demanderTrajet(from, to)
          demandes.set(k, promesse)
        }
        const trajet = await promesse
        if (trajet) trouves.set(k, trajet)
        // Refusée par le plafond (429), pas traitée : elle pourra être redemandée
        // une fois la pause écoulée.
        else if (Date.now() < pauseJusqua) demandes.delete(k)
        // Réponse tardive après démontage : on ne touche plus à l'état.
        if (trajet && monte.current) setResolus(prev => (prev.has(k) ? prev : new Map(prev).set(k, trajet)))
      }
    }

    for (let i = 0; i < PARALLELE_MAX; i++) void ouvrier()
    return () => { actif = false }
  }, [signature])

  return useMemo(() => {
    const trajets = new Map<string, Trajet>()
    for (const p of paires) {
      const t = resolus.get(clePaire(p.from, p.to))
      if (t) trajets.set(p.id, t)
    }
    return trajets
  }, [paires, resolus])
}

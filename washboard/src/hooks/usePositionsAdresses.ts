'use client'

import { useEffect, useMemo, useState } from 'react'
import { cleAdresse, localiser, positionConnue } from '@/lib/positionsAdresses'
import type { Position } from '@/lib/proposerCreneau'

const PARALLELE_MAX = 3
/** Au plus autant d'adresses localisées par ouverture : un carnet énorme ne déclenche pas des
 *  centaines d'appels facturés d'un coup. Les suivantes restent « sans adresse localisée ». */
export const PLAFOND_ADRESSES = 80

/**
 * Positions des adresses données, localisées à mesure (3 requêtes à la fois) quand `actif`.
 * Rend les positions connues (clé : `cleAdresse`), et l'avancement (`fait` sur `total`, à
 * l'intérieur du plafond). Inactif, ne demande RIEN et ne rend que ce que le navigateur
 * retient déjà.
 */
export function usePositionsAdresses(adresses: string[], actif: boolean) {
  const uniques = useMemo(() => {
    const vues = new Set<string>()
    const liste: string[] = []
    for (const a of adresses) {
      const k = cleAdresse(a)
      if (!k || vues.has(k)) continue
      vues.add(k)
      liste.push(a)
    }
    return liste.slice(0, PLAFOND_ADRESSES)
  }, [adresses])
  const signature = useMemo(() => JSON.stringify(uniques), [uniques])

  // Résultats arrivés depuis l'ouverture ; les positions déjà retenues se lisent, elles, à la
  // volée (voir plus bas) : pas d'état à recopier.
  const [arrivees, setArrivees] = useState<Map<string, Position | null>>(() => new Map())

  useEffect(() => {
    if (!actif) return
    let vivant = true
    const file: string[] = (JSON.parse(signature) as string[]).filter(a => positionConnue(a) === undefined)
    async function ouvrier() {
      while (vivant && file.length > 0) {
        const adresse = file.shift()
        if (adresse === undefined) return
        const p = await localiser(adresse)
        if (vivant && p !== undefined) setArrivees(prev => new Map(prev).set(cleAdresse(adresse), p))
      }
    }
    for (let i = 0; i < PARALLELE_MAX; i++) void ouvrier()
    return () => { vivant = false }
  }, [actif, signature])

  return useMemo(() => {
    const positions = new Map<string, Position | null>()
    let fait = 0
    for (const a of uniques) {
      const k = cleAdresse(a)
      const p = arrivees.has(k) ? arrivees.get(k) : positionConnue(a)
      if (p !== undefined) { positions.set(k, p); fait++ }
    }
    return { positions, fait, total: uniques.length }
  }, [uniques, arrivees])
}

'use client'

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'

// Comportement tactile commun aux feuilles du bas de la refonte 2026 (PWA
// seulement) : fiche de rendez-vous, feuille générique de l'agenda, fiche
// client, personnalisation de l'accueil. Deux besoins d'Alexandre, 2026-09-23 :
//   1. la page derrière une feuille ouverte ne doit plus défiler ;
//   2. tirer la poignée grise vers le bas ferme la feuille, comme dans une
//      application native.

// Plusieurs feuilles peuvent être ouvertes en même temps (une fenêtre de
// confirmation par-dessus une fiche) : on ne rend le défilement que quand la
// dernière se ferme, sinon la première fermée le débloquerait sous la seconde.
let feuillesOuvertes = 0
let debordementInitial: { html: string; body: string } | null = null

/** Empêche la page de défiler derrière une feuille, tant qu'elle est montée. */
export function useBloquerDefilement() {
  useEffect(() => {
    if (feuillesOuvertes === 0) {
      debordementInitial = {
        html: document.documentElement.style.overflow,
        body: document.body.style.overflow,
      }
      // html ET body : sur iOS, bloquer le seul body laisse parfois le
      // document défiler.
      document.documentElement.style.overflow = 'hidden'
      document.body.style.overflow = 'hidden'
    }
    feuillesOuvertes += 1
    return () => {
      feuillesOuvertes -= 1
      if (feuillesOuvertes === 0 && debordementInitial) {
        document.documentElement.style.overflow = debordementInitial.html
        document.body.style.overflow = debordementInitial.body
        debordementInitial = null
      }
    }
  }, [])
}

const DISTANCE_FERMETURE_PX = 100
const VITESSE_FERMETURE_PX_PAR_MS = 0.6
const DISTANCE_MIN_GESTE_RAPIDE_PX = 30
const DUREE_SORTIE_MS = 200

/**
 * Tirer la poignée vers le bas suit le doigt ; au relâchement, la feuille se
 * ferme si on est allé assez loin (ou assez vite), sinon elle revient.
 *
 * `poignee` s'étale sur la zone qu'on attrape ; `styleFeuille` se fusionne au
 * style de la feuille elle-même. `touch-action: none` sur la poignée est ce
 * qui empêche le navigateur de prendre le geste pour un défilement.
 */
export function useGlisserPourFermer(onClose: () => void) {
  const [decalage, setDecalage] = useState(0)
  const [enCours, setEnCours] = useState(false)
  const depart = useRef<{ y: number; t: number } | null>(null)
  const decalageRef = useRef(0)
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (minuterie.current) clearTimeout(minuterie.current) }, [])

  function suivre(y: number) {
    if (!depart.current) return
    const d = Math.max(0, y - depart.current.y)
    decalageRef.current = d
    setDecalage(d)
  }

  function relacher() {
    if (!depart.current) return
    const d = decalageRef.current
    const duree = Math.max(1, Date.now() - depart.current.t)
    depart.current = null
    setEnCours(false)
    const geste = d > DISTANCE_FERMETURE_PX || (d > DISTANCE_MIN_GESTE_RAPIDE_PX && d / duree > VITESSE_FERMETURE_PX_PAR_MS)
    if (geste) {
      const sortie = typeof window === 'undefined' ? 800 : window.innerHeight
      decalageRef.current = sortie
      setDecalage(sortie)
      minuterie.current = setTimeout(onClose, DUREE_SORTIE_MS)
    } else {
      decalageRef.current = 0
      setDecalage(0)
    }
  }

  const poignee = {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      e.currentTarget.setPointerCapture(e.pointerId)
      depart.current = { y: e.clientY, t: Date.now() }
      decalageRef.current = 0
      setEnCours(true)
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => suivre(e.clientY),
    onPointerUp: relacher,
    onPointerCancel: relacher,
    style: { touchAction: 'none' } as CSSProperties,
  }

  // Au repos (ni doigt posé, ni décalage), on ne pose AUCUN style : la feuille
  // garde sa propre animation d'ouverture et, après un geste trop court, revient
  // à sa place avec cette même animation.
  const styleFeuille: CSSProperties =
    !enCours && decalage === 0
      ? {}
      : {
          transform: `translateY(${decalage}px)`,
          // Doigt posé : la feuille colle au doigt, sans transition. Sinon, elle
          // sort en 200 ms.
          transitionDuration: enCours ? '0ms' : `${DUREE_SORTIE_MS}ms`,
          transitionTimingFunction: 'var(--v2-ease-out)',
        }

  return { poignee, styleFeuille }
}

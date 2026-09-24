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
const SEUIL_SAISIE_PX = 8

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
  // `depart` : où le doigt s'est posé. `saisi` : le glissement a réellement
  // commencé (seuil franchi), seul moment où l'on capture le pointeur.
  const depart = useRef<{ x: number; y: number; t: number; cible: HTMLElement; id: number } | null>(null)
  const saisi = useRef(false)
  const decalageRef = useRef(0)
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (minuterie.current) clearTimeout(minuterie.current) }, [])

  function relacher() {
    const d0 = depart.current
    const etaitSaisi = saisi.current
    depart.current = null
    saisi.current = false
    if (!d0 || !etaitSaisi) return
    const d = decalageRef.current
    const duree = Math.max(1, Date.now() - d0.t)
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

  // Posé sur toute la bande du haut de la feuille (poignée ET titre) : c'est là
  // qu'un doigt cherche à tirer, la poignée seule ne fait que quelques pixels de
  // haut. Comme cette bande contient aussi le bouton Fermer, le pointeur n'est
  // capturé qu'une fois le seuil de glissement franchi : un simple toucher sur
  // le bouton reste un clic. Doigt et stylet seulement — à la souris, sur
  // ordinateur, la feuille est une fenêtre centrée qu'on ne tire pas.
  const poignee = {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType === 'mouse') return
      depart.current = { x: e.clientX, y: e.clientY, t: Date.now(), cible: e.currentTarget, id: e.pointerId }
      saisi.current = false
      decalageRef.current = 0
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const d0 = depart.current
      if (!d0) return
      const dy = e.clientY - d0.y
      const dx = e.clientX - d0.x
      if (!saisi.current) {
        // Seuil : vers le bas, et plus vertical qu'horizontal.
        if (dy < SEUIL_SAISIE_PX || Math.abs(dy) < Math.abs(dx)) return
        saisi.current = true
        try { d0.cible.setPointerCapture(d0.id) } catch { /* pointeur déjà libéré */ }
        setEnCours(true)
      }
      const d = Math.max(0, dy)
      decalageRef.current = d
      setDecalage(d)
    },
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

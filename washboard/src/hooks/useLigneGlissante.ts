'use client'

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type RefObject } from 'react'

// Ligne de liste qu'on glisse vers la gauche pour faire apparaître une action
// (le bouton rouge « Supprimer » avec sa poubelle), comme sur iPhone. Demande
// d'Alexandre, 2026-09-25. Doigt et stylet seulement : à la souris, sur
// ordinateur, l'action reste joignable par la feuille d'édition.
//
// Le glissement ne démarre qu'après 8 px, plus horizontal que vertical, pour que
// faire défiler la liste au doigt ne déplace jamais une ligne, et qu'un simple
// toucher reste un clic. `touch-action: pan-y` (dans `styleContenu`) laisse le
// navigateur gérer le défilement vertical, et nous livre le horizontal.

export const LARGEUR_ACTION_PX = 88
const SEUIL_SAISIE_PX = 8
const SEUIL_OUVERTURE_PX = 44
const VITESSE_OUVERTURE_PX_PAR_MS = 0.5
const DEPASSEMENT_PX = 20

type Options = {
  /** La ligne est ouverte (action visible) : l'état vit chez le parent, pour qu'une seule
   *  ligne soit ouverte à la fois. */
  ouverte: boolean
  onOuvrir: () => void
  onFermer: () => void
}

export function useLigneGlissante({ ouverte, onOuvrir, onFermer }: Options): {
  refLigne: RefObject<HTMLLIElement | null>
  poignee: {
    onPointerDown: (e: PointerEvent<HTMLElement>) => void
    onPointerMove: (e: PointerEvent<HTMLElement>) => void
    onPointerUp: () => void
    onPointerCancel: () => void
  }
  styleContenu: CSSProperties
  /** À appeler au début du `onClick` de la ligne : vrai si le clic est la fin d'un
   *  glissement (à ignorer) ou s'il ne sert qu'à refermer la ligne (déjà traité). */
  clicAbsorbe: () => boolean
} {
  const [decalage, setDecalage] = useState(0)
  const [enCours, setEnCours] = useState(false)
  const depart = useRef<{ x: number; y: number; t: number; base: number; cible: HTMLElement; id: number } | null>(null)
  const saisi = useRef(false)
  const decalageRef = useRef(0)
  const ignorerClic = useRef(false)
  const refLigne = useRef<HTMLLIElement | null>(null)
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (minuterie.current) clearTimeout(minuterie.current) }, [])

  // Un toucher hors de la ligne ouverte la referme.
  useEffect(() => {
    if (!ouverte) return
    const dehors = (e: globalThis.PointerEvent) => {
      if (refLigne.current && !refLigne.current.contains(e.target as Node)) onFermer()
    }
    document.addEventListener('pointerdown', dehors)
    return () => document.removeEventListener('pointerdown', dehors)
  }, [ouverte, onFermer])

  function relacher() {
    const d0 = depart.current
    const etaitSaisi = saisi.current
    depart.current = null
    saisi.current = false
    if (!d0 || !etaitSaisi) return
    const d = decalageRef.current
    const duree = Math.max(1, Date.now() - d0.t)
    const vers = d - d0.base // négatif : vers la gauche
    setEnCours(false)
    // Le clic synthétisé qui suit le relâchement n'est pas un toucher voulu.
    ignorerClic.current = true
    minuterie.current = setTimeout(() => { ignorerClic.current = false }, 350)
    const ouvrirVite = vers < 0 && Math.abs(vers) / duree > VITESSE_OUVERTURE_PX_PAR_MS && Math.abs(vers) > 16
    if (d < -SEUIL_OUVERTURE_PX || ouvrirVite) onOuvrir()
    else onFermer()
  }

  const poignee = {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType === 'mouse') return
      depart.current = {
        x: e.clientX, y: e.clientY, t: Date.now(),
        base: ouverte ? -LARGEUR_ACTION_PX : 0,
        cible: e.currentTarget, id: e.pointerId,
      }
      saisi.current = false
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const d0 = depart.current
      if (!d0) return
      const dx = e.clientX - d0.x
      const dy = e.clientY - d0.y
      if (!saisi.current) {
        if (Math.abs(dx) < SEUIL_SAISIE_PX || Math.abs(dx) < Math.abs(dy)) return
        saisi.current = true
        try { d0.cible.setPointerCapture(d0.id) } catch { /* pointeur déjà libéré */ }
        setEnCours(true)
      }
      const d = Math.min(0, Math.max(-LARGEUR_ACTION_PX - DEPASSEMENT_PX, d0.base + dx))
      decalageRef.current = d
      setDecalage(d)
    },
    onPointerUp: relacher,
    onPointerCancel: relacher,
  }

  const position = enCours ? decalage : (ouverte ? -LARGEUR_ACTION_PX : 0)
  const styleContenu: CSSProperties = {
    transform: `translateX(${position}px)`,
    transitionProperty: 'transform',
    transitionDuration: enCours ? '0ms' : '220ms',
    transitionTimingFunction: 'var(--v2-ease-out)',
    touchAction: 'pan-y',
  }

  function clicAbsorbe(): boolean {
    if (ignorerClic.current) return true
    // Ligne ouverte : toucher son contenu la referme au lieu d'ouvrir la fiche.
    if (ouverte) { onFermer(); return true }
    return false
  }

  return { refLigne, poignee, styleContenu, clicAbsorbe }
}

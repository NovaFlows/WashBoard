'use client'

import { useEffect, useRef, useState } from 'react'

// Les deux illustrations animées de l'onboarding v2 (maquette du 2026-10-14, validée par
// Alexandre) : la carte des zones de déplacement à l'étape de l'adresse, et les bulles de
// mousse de l'écran de fin. Styles et images-clés : bloc « Entrée dans l'app » de globals.css.

function Etiquette({ x, y, texte }: { x: number; y: number; texte: string }) {
  const largeur = texte.length * 6.4 + 14
  return (
    <>
      <rect x={x - largeur / 2} y={y - 10} width={largeur} height={19} rx={9.5} fill="var(--v2-color-surface)" stroke="var(--v2-filet-fort)" />
      <text x={x} y={y + 3.5} textAnchor="middle" fontSize="10.5" fontWeight={600} fill="var(--v2-color-encre)">{texte}</text>
    </>
  )
}

/** Carte d'exemple : une épingle et trois cercles de zones apparaissent dès que l'adresse
 *  est saisie. Purement illustrative (tarifs d'exemple) : les vraies zones se règlent plus
 *  tard dans le tableau de bord, la légende le dit. */
export function CarteZones({ adressePosee }: { adressePosee: boolean }) {
  // L'animation ne joue qu'au passage de « vide » à « remplie », pas à chaque lettre tapée.
  // (état ajusté pendant le rendu, motif recommandé par React plutôt qu'un effet)
  const [precedente, setPrecedente] = useState(adressePosee)
  const [anime, setAnime] = useState(false)
  if (precedente !== adressePosee) {
    setPrecedente(adressePosee)
    setAnime(adressePosee)
  }

  return (
    <div className={`wb-entree-carte overflow-hidden rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] ${anime ? 'wb-entree-carte-anime' : ''}`}>
      <svg viewBox="0 0 320 180" role="img" aria-label="Exemple de zones de déplacement autour de ton adresse" className="block h-auto w-full">
        <g fill="none" stroke="var(--v2-filet-fort)" strokeLinecap="round">
          <path strokeWidth="7" d="M-10 120 C 70 110, 120 60, 200 70 S 300 40, 340 30" />
          <path strokeWidth="4" d="M60 -10 C 80 50, 130 110, 150 190" />
          <path strokeWidth="4" d="M330 140 C 260 120, 220 150, 170 120 S 90 150, -10 60" />
          <path strokeWidth="3" d="M250 -10 C 240 40, 270 100, 300 190" />
        </g>
        {adressePosee ? (
          <>
            <circle className="zone z3" cx="160" cy="92" r="88" fill="var(--v2-color-accent)" fillOpacity=".05" stroke="var(--v2-color-accent)" strokeOpacity=".3" strokeDasharray="3 4" />
            <circle className="zone z2" cx="160" cy="92" r="58" fill="var(--v2-color-accent)" fillOpacity=".09" stroke="var(--v2-color-accent)" strokeOpacity=".4" strokeDasharray="3 4" />
            <circle className="zone" cx="160" cy="92" r="30" fill="var(--v2-color-accent)" fillOpacity=".16" stroke="var(--v2-color-accent)" strokeOpacity=".55" strokeDasharray="3 4" />
            <g className="etiquettes">
              <Etiquette x={160} y={112} texte="Offert" />
              <Etiquette x={222} y={52} texte="+5 €" />
              <Etiquette x={258} y={22} texte="+10 €" />
            </g>
            <g className="epingle">
              <path d="M160 96 c-9 -12 -14 -18 -14 -25 a14 14 0 0 1 28 0 c0 7 -5 13 -14 25z" fill="var(--v2-color-encre)" />
              <circle cx="160" cy="71" r="5" fill="var(--v2-color-surface)" />
            </g>
          </>
        ) : (
          <text x="160" y="96" textAnchor="middle" fontSize="12.5" fontWeight={500} fill="var(--v2-color-gris)">
            Tape ton adresse : tes zones apparaissent ici
          </text>
        )}
      </svg>
    </div>
  )
}

type Bulle = { x: number; y: number; rayon: number; vitesse: number; phase: number; fin: number; eclat: number }

/** Bulles de mousse qui montent puis éclatent, une seule fois, par-dessus tout l'écran. */
export function Mousse() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = ref.current
    if (!cv || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const l = window.innerWidth, h = window.innerHeight, dpr = window.devicePixelRatio || 1
    cv.width = l * dpr; cv.height = h * dpr
    ctx.scale(dpr, dpr)
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--v2-color-accent').trim() || '#306090'
    const bulles: Bulle[] = Array.from({ length: l > 900 ? 70 : 46 }, () => ({
      x: Math.random() * l, y: h + Math.random() * h * 0.6,
      rayon: 4 + Math.random() * 16, vitesse: 1.6 + Math.random() * 2.8,
      phase: Math.random() * 6.28, fin: h * (0.05 + Math.random() * 0.6), eclat: 0,
    }))
    const debut = performance.now()
    let image = 0
    const dessiner = (t: number) => {
      const ecoule = t - debut
      ctx.clearRect(0, 0, l, h)
      let vivantes = 0
      for (const b of bulles) {
        if (b.eclat > 1) continue
        vivantes++
        if (b.y > b.fin && !b.eclat) { b.y -= b.vitesse; b.x += Math.sin(ecoule / 300 + b.phase) * 0.6 }
        else b.eclat += 0.08
        const r = b.rayon * (1 + b.eclat * 0.6), a = Math.max(1 - b.eclat, 0)
        ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2)
        ctx.globalAlpha = a * 0.9; ctx.strokeStyle = accent; ctx.lineWidth = 1.4; ctx.stroke()
        ctx.globalAlpha = a * 0.12; ctx.fillStyle = accent; ctx.fill()
        ctx.globalAlpha = a * 0.8; ctx.beginPath(); ctx.arc(b.x - r * 0.35, b.y - r * 0.35, r * 0.22, 0, Math.PI * 2)
        ctx.fillStyle = '#FFFFFF'; ctx.fill()
      }
      ctx.globalAlpha = 1
      if (vivantes && ecoule < 4500) image = requestAnimationFrame(dessiner)
      else ctx.clearRect(0, 0, l, h)
    }
    image = requestAnimationFrame(dessiner)
    return () => cancelAnimationFrame(image)
  }, [])

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-40 h-full w-full" />
}

'use client'

import { useEffect, useRef, useState } from 'react'

type Pt = [number, number]
const H: Pt = [70, 250]
const A: Pt = [268, 70]
const B: Pt = [322, 96]
const C: Pt = [288, 136]
const KM_SANS = 64
const KM_AVEC = 46

const trace = (pts: Pt[]) => pts.map((q, i) => `${i ? 'L' : 'M'}${q.join(' ')}`).join(' ')
const SANS = trace([H, A, H, B, H, C, H])
const AVEC = `M${H[0]} ${H[1]} Q 150 140 ${A[0]} ${A[1]} L ${B[0]} ${B[1]} L ${C[0]} ${C[1]} Q 170 210 ${H[0]} ${H[1]}`

const RUES_V = Array.from({ length: 9 }, (_, i) => ({ d: `M${i * 52 - 20} 0 L${i * 52 + 18} 310`, w: i % 3 === 1 ? 6 : 2 }))
const RUES_H = Array.from({ length: 7 }, (_, i) => ({ d: `M0 ${i * 50 + 12} L400 ${i * 50 - 8}`, w: i % 3 === 2 ? 6 : 2 }))

function Epingle({ p, t, coul = 'var(--encre)' }: { p: Pt; t: string; coul?: string }) {
  return (
    <g transform={`translate(${p[0]} ${p[1]})`}>
      <path d="M0 0c-7-9-11-14-11-19a11 11 0 0 1 22 0c0 5-4 10-11 19z" style={{ fill: coul }} />
      <circle cx="0" cy="-19" r="4" style={{ fill: 'var(--surface)' }} />
      <rect x="-21" y="-49" width="42" height="18" rx="9" style={{ fill: 'var(--surface)', stroke: 'var(--filet)' }} />
      <text x="0" y="-36" textAnchor="middle" fontSize="10.5" fontWeight="650" style={{ fill: 'var(--encre)' }} fontFamily="var(--font-archivo), sans-serif">{t}</text>
    </g>
  )
}

export default function CarteCreneaux({ avec }: { avec: boolean }) {
  const [km, setKm] = useState(KM_SANS)
  const kmActuel = useRef(KM_SANS)
  const premier = useRef(true)

  // Compteur animé sur 1 s (saut direct si l'utilisateur réduit les animations).
  useEffect(() => {
    const cible = avec ? KM_AVEC : KM_SANS
    if (premier.current) { premier.current = false; return }
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const duree = reduit ? 1 : 1000
    const de = kmActuel.current
    const t0 = performance.now()
    let raf = 0
    const pas = (t: number) => {
      const p = Math.min(1, (t - t0) / duree)
      kmActuel.current = Math.round(de + (cible - de) * (1 - Math.pow(1 - p, 3)))
      setKm(kmActuel.current)
      if (p < 1) raf = requestAnimationFrame(pas)
    }
    raf = requestAnimationFrame(pas)
    return () => cancelAnimationFrame(raf)
  }, [avec])

  return (
    <div className="carte-cg">
      <svg viewBox="0 0 400 310" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Carte illustrative de trois rendez-vous proches">
        <rect width="400" height="310" style={{ fill: 'var(--surface-2)' }} />
        {RUES_V.map((r, i) => <path key={`v${i}`} d={r.d} style={{ stroke: 'var(--filet)' }} strokeWidth={r.w} fill="none" />)}
        {RUES_H.map((r, i) => <path key={`h${i}`} d={r.d} style={{ stroke: 'var(--filet)' }} strokeWidth={r.w} fill="none" />)}
        <path d="M-10 190 C 80 170 140 230 230 205 S 350 160 420 180" style={{ stroke: 'var(--accent-doux)' }} strokeWidth="16" fill="none" />
        <circle cx="293" cy="100" r="66" fill="none" style={{ stroke: 'var(--gris-2)' }} strokeDasharray="3 5" />
        <path className="trajet" d={SANS} style={{ stroke: 'var(--rouge)', opacity: avec ? 0 : 1 }} pathLength={100} strokeDasharray="100" strokeDashoffset={avec ? 100 : 0} />
        <path className="trajet" d={AVEC} style={{ stroke: 'var(--accent)' }} pathLength={100} strokeDasharray="100" strokeDashoffset={avec ? 0 : 100} />
        <Epingle p={A} t="09:00" /><Epingle p={B} t="14:00" /><Epingle p={C} t="15:30" coul="var(--vert)" />
        <g transform={`translate(${H[0]} ${H[1]})`}>
          <circle r="13" style={{ fill: 'var(--encre)' }} />
          <path d="M-5 1 0-4 5 1v5h-10z" style={{ fill: 'var(--surface)' }} />
          <text x="0" y="28" textAnchor="middle" fontSize="11" fontWeight="650" style={{ fill: 'var(--encre)' }} fontFamily="var(--font-archivo), sans-serif">Toi</text>
        </g>
      </svg>
      <div className="cg-km"><small>Route dans la journée</small><b className="num">{km} km</b></div>
      <div className={`cg-gain${avec ? ' vu' : ''}`} aria-hidden>−{KM_SANS - KM_AVEC} km</div>
    </div>
  )
}

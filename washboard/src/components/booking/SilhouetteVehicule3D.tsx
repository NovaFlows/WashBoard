'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { SILHOUETTES, silhouettePour, type Silhouette } from '@/lib/silhouettesVehicules'
import './silhouetteVehicule.css'

// Le véhicule choisi sur la page de réservation, en silhouette 3D (demande d'Alexandre,
// 2026-10-18 : « comme la carte, une animation rotation 3D 360 »). Un autocollant épais :
// face avant, face arrière (la silhouette vue de dos, donc tournée vers la gauche) et des
// couches de tranche entre les deux, visibles quand il passe de profil. À chaque nouveau
// véhicule, il apparaît en faisant un tour complet ; ensuite il flotte et suit la souris.
// Le parent change la `key` pour rejouer l'apparition.

const COUCHES = 9
const EPAISSEUR = 7 // px, de la face avant à la face arrière
const VUE = '-12 -8 424 176'

const courbe = {
  cubique: (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  sortie: (p: number) => 1 - Math.pow(1 - p, 3),
  rebond: (p: number) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2) },
}

/** Le contour blanc, commun aux faces et à la tranche (couleur reçue de `color`). */
function Contour({ s }: { s: Silhouette }) {
  return (
    <>
      {s.corps.map((d, i) => <path key={`c${i}`} d={d} fill="currentColor" stroke="currentColor" strokeWidth={14} strokeLinejoin="round" />)}
      {s.traits?.map((t, i) => <path key={`t${i}`} d={t.d} fill="none" stroke="currentColor" strokeWidth={t.w + 14} strokeLinecap="round" strokeLinejoin="round" />)}
      {s.roues.map((r, i) => <circle key={`r${i}`} cx={r.cx} cy={r.cy} r={r.r + 7} fill="currentColor" />)}
    </>
  )
}

/** Une face complète : contour, carrosserie, roues, vitres, liserés, ombre et reflet. */
function Face({ s, ids, reflet }: { s: Silhouette; ids: { decoupe: string; ombre: string; eclat: string }; reflet?: React.Ref<SVGRectElement> }) {
  return (
    <>
      <g style={{ color: '#FFFFFF' }}><Contour s={s} /></g>
      {s.corps.map((d, i) => <path key={`c${i}`} d={d} fill="#B6B6BC" />)}
      {s.traits?.map((t, i) => <path key={`t${i}`} d={t.d} fill="none" stroke="#B6B6BC" strokeWidth={t.w} strokeLinecap="round" strokeLinejoin="round" />)}
      {s.roues.map((r, i) => r.fin
        ? <g key={`r${i}`}><circle cx={r.cx} cy={r.cy} r={r.r - 3} fill="none" stroke="#A3A3AA" strokeWidth={6} /><circle cx={r.cx} cy={r.cy} r={4} fill="#A3A3AA" /></g>
        : <g key={`r${i}`}><circle cx={r.cx} cy={r.cy} r={r.r} fill="#A7A7AD" /><circle cx={r.cx} cy={r.cy} r={r.r * 0.62} fill="#B9B9BF" stroke="#C4C4C9" strokeWidth={1.5} /></g>)}
      {s.vitres?.map((d, i) => <path key={`v${i}`} d={d} fill="#D3D3D8" />)}
      {s.lignes?.map((d, i) => <path key={`l${i}`} d={d} fill="none" stroke="#A9A9AF" strokeWidth={1.6} strokeLinecap="round" />)}
      <g clipPath={`url(#${ids.decoupe})`}>
        <rect x={-12} y={-8} width={424} height={176} fill={`url(#${ids.ombre})`} />
        <rect ref={reflet} x={-200} y={-8} width={150} height={176} fill={`url(#${ids.eclat})`} />
      </g>
    </>
  )
}

export default function SilhouetteVehicule3D({ type, nom }: { type: string | null; nom?: string | null }) {
  const s = silhouettePour(type)
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const ids = { decoupe: `wb-sv-decoupe-${uid}`, ombre: `wb-sv-ombre-${uid}`, eclat: `wb-sv-eclat-${uid}` }
  const scene = useRef<HTMLDivElement>(null)
  const objet = useRef<HTMLDivElement>(null)
  const ombre = useRef<HTMLDivElement>(null)
  const refletAvant = useRef<SVGRectElement>(null)
  const refletArriere = useRef<SVGRectElement>(null)
  const pointeur = useRef<{ x: number; y: number } | null>(null)
  const [nomVisible, setNomVisible] = useState(false)

  useEffect(() => {
    if (!s) return
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let vivant = true
    let raf = 0
    let visible = true
    let annonce = false
    const t0 = performance.now()
    const DUREE = reduit ? 300 : 1500
    const m = { tx: 0, ty: 0 }

    const image = (t: number) => {
      if (!vivant || !visible) { raf = 0; return }
      const el = objet.current
      if (!el) return
      const p = Math.min(1, (t - t0) / DUREE)
      // Apparition : il arrive de biais, petit, fait un tour complet et se pose.
      let tour = 0, echelle = 1, opacite = 1
      if (!reduit) {
        tour = p < 0.82 ? -110 + (368 + 110) * courbe.cubique(p / 0.82) : 368 - 8 * courbe.sortie((p - 0.82) / 0.18)
        echelle = 0.55 + 0.45 * courbe.rebond(Math.min(1, p / 0.6))
      }
      opacite = Math.min(1, p * 3)
      if (p >= 1 && !annonce) { annonce = true; setNomVisible(true) }
      // Ensuite : il flotte, se balance doucement, et suit la souris quand elle passe dessus.
      const repos = reduit ? 0 : Math.min(1, Math.max(0, (t - t0 - DUREE) / 600))
      const cx = pointeur.current ? pointeur.current.x : 0
      const cy = pointeur.current ? pointeur.current.y : Math.sin(t / 2100) * 9 * repos
      m.tx += (cx - m.tx) * 0.08
      m.ty += (cy - m.ty) * 0.08
      const flotte = Math.sin(t / 1400) * 3 * repos
      const angle = tour + m.ty
      el.style.opacity = String(opacite)
      el.style.transform = `translateY(${flotte.toFixed(2)}px) rotateX(${m.tx.toFixed(2)}deg) rotateY(${angle.toFixed(2)}deg) scale(${echelle.toFixed(3)})`
      // Le reflet balaie la face à mesure qu'elle tourne.
      const a = (angle * Math.PI) / 180
      const x = (120 - Math.sin(a) * 300).toFixed(1)
      refletAvant.current?.setAttribute('x', x)
      refletArriere.current?.setAttribute('x', x)
      if (ombre.current) ombre.current.style.transform = `translateX(-50%) scaleX(${(0.4 + 0.6 * Math.abs(Math.cos(a))).toFixed(3)})`
      raf = requestAnimationFrame(image)
    }
    const relancer = () => { if (!raf && vivant && visible) raf = requestAnimationFrame(image) }

    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; relancer() })
    if (scene.current) io.observe(scene.current)
    const bouger = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const r = scene.current?.getBoundingClientRect()
      if (!r) return
      pointeur.current = {
        x: Math.max(-10, Math.min(10, -((e.clientY - (r.top + r.height / 2)) / (r.height / 2)) * 10)),
        y: Math.max(-22, Math.min(22, ((e.clientX - (r.left + r.width / 2)) / (r.width / 2)) * 22)),
      }
    }
    const quitter = () => { pointeur.current = null }
    const zone = scene.current
    zone?.addEventListener('pointermove', bouger)
    zone?.addEventListener('pointerleave', quitter)
    relancer()
    return () => {
      vivant = false
      if (raf) cancelAnimationFrame(raf)
      io.disconnect()
      zone?.removeEventListener('pointermove', bouger)
      zone?.removeEventListener('pointerleave', quitter)
    }
  }, [s])

  // Avant le choix : la place reste réservée, une silhouette en pointillés invite à choisir.
  if (!s) {
    return (
      <div className="wb-sv" aria-hidden>
        <div className="wb-sv-scene">
          <svg viewBox={VUE} className="wb-sv-face wb-sv-attente" style={{ filter: 'none' }}>
            <path d={SILHOUETTES.citadine.corps[0]} fill="none" stroke="currentColor" strokeWidth={2.5} strokeDasharray="7 7" strokeLinejoin="round" />
            {SILHOUETTES.citadine.roues.map((r, i) => <circle key={i} cx={r.cx} cy={r.cy} r={r.r} fill="none" stroke="currentColor" strokeWidth={2.5} strokeDasharray="7 7" />)}
          </svg>
        </div>
        <p className="wb-sv-nom">Choisissez votre véhicule</p>
      </div>
    )
  }

  const tranche = Array.from({ length: COUCHES }, (_, i) => -EPAISSEUR / 2 + 0.6 + (i * (EPAISSEUR - 1.2)) / (COUCHES - 1))

  return (
    <div className="wb-sv" role="img" aria-label={nom ? `Votre véhicule : ${nom}` : 'Votre véhicule'}>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        <defs>
          <clipPath id={ids.decoupe}>
            {s.corps.map((d, i) => <path key={i} d={d} />)}
            {s.roues.map((r, i) => <circle key={`r${i}`} cx={r.cx} cy={r.cy} r={r.r} />)}
          </clipPath>
          <linearGradient id={ids.ombre} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0.45" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.12" />
          </linearGradient>
          <linearGradient id={ids.eclat} x1="0" y1="0" x2="1" y2="0.35">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <div ref={scene} className="wb-sv-scene">
        <div ref={ombre} className="wb-sv-ombre" />
        <div ref={objet} className="wb-sv-objet" data-cache="oui" aria-hidden>
          {tranche.map((z, i) => (
            <svg key={i} viewBox={VUE} className="wb-sv-couche" style={{ transform: `translateZ(${z.toFixed(2)}px)` }}>
              <Contour s={s} />
            </svg>
          ))}
          <svg viewBox={VUE} className="wb-sv-face" style={{ transform: `translateZ(${EPAISSEUR / 2}px)` }}>
            <Face s={s} ids={ids} reflet={refletAvant} />
          </svg>
          <svg viewBox={VUE} className="wb-sv-face" style={{ transform: `rotateY(180deg) translateZ(${EPAISSEUR / 2}px)` }}>
            <Face s={s} ids={ids} reflet={refletArriere} />
          </svg>
        </div>
      </div>
      {nom && <p className="wb-sv-nom" data-visible={nomVisible ? 'oui' : 'non'}>{nom}</p>}
    </div>
  )
}

'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { SILHOUETTES, silhouettePour, type Roue, type Silhouette } from '@/lib/silhouettesVehicules'
import './silhouetteVehicule.css'

// Le véhicule choisi sur la page de réservation, en silhouette 3D (demande d'Alexandre,
// 2026-10-18 : « comme la carte, une animation rotation 3D 360 »). Un autocollant épais :
// face avant, face arrière (la silhouette vue de dos, donc tournée vers la gauche) et des
// couches de tranche entre les deux, visibles quand il passe de profil. À chaque nouveau
// véhicule, il apparaît en faisant un tour complet ; ensuite il flotte et suit la souris.
// Le parent change la `key` pour rejouer l'apparition.

const COUCHES = 9
const EPAISSEUR = 7 // px, de la face avant à la face arrière
const VUE = '-20 -10 1040 420'
const CONTOUR = 12 // épaisseur du contour blanc, dans le repère de 1000 de large

const courbe = {
  cubique: (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  sortie: (p: number) => 1 - Math.pow(1 - p, 3),
  rebond: (p: number) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2) },
}

/** Le contour blanc, commun aux faces et à la tranche (couleur reçue de `color`). */
function Contour({ s }: { s: Silhouette }) {
  return (
    <>
      {[...s.corps, ...(s.sombres ?? []), ...s.passages].map((d, i) => <path key={`c${i}`} d={d} fill="currentColor" stroke="currentColor" strokeWidth={CONTOUR} strokeLinejoin="round" />)}
      {s.traits?.map((t, i) => <path key={`t${i}`} d={t.d} fill="none" stroke="currentColor" strokeWidth={t.w + CONTOUR} strokeLinecap="round" strokeLinejoin="round" />)}
      {s.roues.map((r, i) => <circle key={`r${i}`} cx={r.cx} cy={r.cy} r={r.r + CONTOUR / 2} fill="currentColor" />)}
    </>
  )
}

const point = (cx: number, cy: number, a: number, r: number) => `${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`

/** Une roue : pneu, et une jante selon le véhicule (alu à cinq doubles branches, moto,
 *  scooter, vélo à rayons). */
function Jante({ r: roue }: { r: Roue }) {
  const { cx, cy, r } = roue
  if (roue.jante === 'velo') {
    return (
      <g>
        <circle cx={cx} cy={cy} r={r - 6} fill="none" stroke="#7C7C83" strokeWidth={12} />
        <circle cx={cx} cy={cy} r={r - 14} fill="none" stroke="#C9C9CE" strokeWidth={3} />
        {Array.from({ length: 18 }, (_, k) => {
          const a = (k / 18) * Math.PI * 2
          return <path key={k} d={`M ${cx} ${cy} L ${point(cx, cy, a, r - 15)}`} stroke="#B9B9BF" strokeWidth={1.6} />
        })}
        <circle cx={cx} cy={cy} r={9} fill="#A5A5AC" />
      </g>
    )
  }
  if (roue.jante === 'moto' || roue.jante === 'scooter') {
    const rj = r * (roue.jante === 'moto' ? 0.72 : 0.62)
    return (
      <g>
        <circle cx={cx} cy={cy} r={r} fill="#76767D" />
        <circle cx={cx} cy={cy} r={rj} fill="#8E8E95" />
        {roue.jante === 'moto' && <circle cx={cx} cy={cy} r={rj * 0.7} fill="none" stroke="#C3C3C8" strokeWidth={7} />}
        {Array.from({ length: 5 }, (_, k) => {
          const a = (k / 5) * Math.PI * 2 - Math.PI / 2
          return roue.jante === 'moto'
            ? <path key={k} d={`M ${point(cx, cy, a - 0.1, rj * 0.24)} L ${point(cx, cy, a - 0.05, rj - 3)} L ${point(cx, cy, a + 0.05, rj - 3)} L ${point(cx, cy, a + 0.1, rj * 0.24)} Z`} fill="#D0D0D5" />
            : <circle key={k} cx={cx + Math.cos(a) * rj * 0.55} cy={cy + Math.sin(a) * rj * 0.55} r={rj * 0.18} fill="#76767D" />
        })}
        <circle cx={cx} cy={cy} r={rj * 0.22} fill="#C4C4C9" />
        <circle cx={cx} cy={cy} r={rj} fill="none" stroke="#D6D6DA" strokeWidth={2.5} />
      </g>
    )
  }
  const rj = r * 0.66
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#7C7C83" />
      <circle cx={cx} cy={cy} r={r - 5} fill="none" stroke="#88888F" strokeWidth={3} />
      <circle cx={cx} cy={cy} r={rj} fill="#8E8E95" />
      {Array.from({ length: 10 }, (_, k) => {
        const a = (Math.floor(k / 2) / 5) * Math.PI * 2 + (k % 2 ? 0.13 : -0.13) - Math.PI / 2
        return <path key={k} d={`M ${point(cx, cy, a - 0.07, rj * 0.24)} L ${point(cx, cy, a - 0.09, rj - 3)} L ${point(cx, cy, a + 0.09, rj - 3)} L ${point(cx, cy, a + 0.07, rj * 0.24)} Z`} fill="#D2D2D7" />
      })}
      <circle cx={cx} cy={cy} r={rj * 0.26} fill="#C4C4C9" />
      <circle cx={cx} cy={cy} r={rj} fill="none" stroke="#DADADE" strokeWidth={2.5} />
    </g>
  )
}

type Ids = { decoupe: string; ombre: string; eclat: string; caisse: string; verre: string }

/** Une face complète : contour, passages de roue, carrosserie, vitres, montants, feux,
 *  liserés, poignées, roues, puis l'ombre du bas et le reflet qui balaie. */
function Face({ s, ids, reflet }: { s: Silhouette; ids: Ids; reflet?: React.Ref<SVGRectElement> }) {
  return (
    <>
      <g style={{ color: '#FFFFFF' }}><Contour s={s} /></g>
      {s.passages.map((d, i) => <path key={`p${i}`} d={d} fill="#6F6F76" />)}
      {s.corps.map((d, i) => <path key={`c${i}`} d={d} fill={`url(#${ids.caisse})`} />)}
      {s.traits?.map((t, i) => <path key={`t${i}`} d={t.d} fill="none" stroke="#ABABB1" strokeWidth={t.w} strokeLinecap="round" strokeLinejoin="round" />)}
      {s.sombres?.map((d, i) => <path key={`s${i}`} d={d} fill="#9A9AA1" />)}
      {s.vitres?.map((d, i) => <path key={`v${i}`} d={d} fill={`url(#${ids.verre})`} />)}
      {s.montants?.map((d, i) => <path key={`m${i}`} d={d} fill="#8D8D94" />)}
      {s.feux?.map((l, i) => <path key={`f${i}`} d={l.d} fill={l.ton === 'clair' ? '#E4E4E8' : '#97979E'} />)}
      {s.details?.map((d, i) => <path key={`d${i}`} d={d} fill="none" stroke="#D3D3D8" strokeWidth={3} strokeLinecap="round" />)}
      {s.lignes?.map((d, i) => <path key={`l${i}`} d={d} fill="none" stroke="#97979E" strokeWidth={2.2} strokeLinecap="round" />)}
      {s.poignees?.map((d, i) => <path key={`h${i}`} d={d} fill="#A6A6AD" />)}
      {s.roues.map((r, i) => <Jante key={`r${i}`} r={r} />)}
      <g clipPath={`url(#${ids.decoupe})`}>
        <rect x={-20} y={-10} width={1040} height={420} fill={`url(#${ids.ombre})`} />
        <rect ref={reflet} x={-400} y={-10} width={340} height={420} fill={`url(#${ids.eclat})`} />
      </g>
    </>
  )
}

export default function SilhouetteVehicule3D({ type, nom }: { type: string | null; nom?: string | null }) {
  const s = silhouettePour(type)
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const ids: Ids = { decoupe: `wb-sv-decoupe-${uid}`, ombre: `wb-sv-ombre-${uid}`, eclat: `wb-sv-eclat-${uid}`, caisse: `wb-sv-caisse-${uid}`, verre: `wb-sv-verre-${uid}` }
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
      const x = (330 - Math.sin(a) * 760).toFixed(1)
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
            <path d={SILHOUETTES.citadine.corps[0]} fill="none" stroke="currentColor" strokeWidth={5} strokeDasharray="16 14" strokeLinejoin="round" />
            {SILHOUETTES.citadine.roues.map((r, i) => <circle key={i} cx={r.cx} cy={r.cy} r={r.r} fill="none" stroke="currentColor" strokeWidth={5} strokeDasharray="16 14" />)}
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
            {[...s.corps, ...(s.sombres ?? []), ...s.passages].map((d, i) => <path key={i} d={d} />)}
            {s.roues.map((r, i) => <circle key={`r${i}`} cx={r.cx} cy={r.cy} r={r.r} />)}
          </clipPath>
          <linearGradient id={ids.caisse} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#C9C9CE" /><stop offset="0.55" stopColor="#B5B5BB" /><stop offset="1" stopColor="#A3A3AA" />
          </linearGradient>
          <linearGradient id={ids.verre} x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0" stopColor="#E2E2E6" /><stop offset="1" stopColor="#C7C7CD" />
          </linearGradient>
          <linearGradient id={ids.ombre} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0.5" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id={ids.eclat} x1="0" y1="0" x2="1" y2="0.35">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.45" />
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

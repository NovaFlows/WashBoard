'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { silhouettePour } from '@/lib/silhouettesVehicules'
import './silhouetteVehicule.css'

// Le véhicule choisi sur la page de réservation, en 3D (demande d'Alexandre, 2026-10-18 :
// « comme la carte, une animation rotation 3D 360 », puis la vraie voiture détourée de sa photo
// plutôt qu'une silhouette dessinée). Une plaque épaisse : la photo devant, la même au dos (vue
// de derrière, donc en miroir, tournée vers la gauche) et des couches assombries entre les deux,
// qui font la tranche quand elle passe de profil. À chaque nouveau véhicule, elle apparaît en faisant un tour
// complet ; ensuite elle flotte et suit la souris. Un reflet balaie la carrosserie, découpé à sa
// forme par un masque CSS. Le parent change la `key` pour rejouer.

const COUCHES = 10
const EPAISSEUR = 5 // px, de la face avant à la face arrière

const courbe = {
  cubique: (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  sortie: (p: number) => 1 - Math.pow(1 - p, 3),
  rebond: (p: number) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2) },
}

/** Attend qu'une image soit prête à s'afficher, sans jamais bloquer plus d'1,5 s. */
function prete(url: string): Promise<void> {
  return new Promise(resoudre => {
    const img = new Image()
    const fin = () => resoudre()
    const garde = setTimeout(fin, 1500)
    img.onload = () => { clearTimeout(garde); (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(fin) }
    img.onerror = () => { clearTimeout(garde); fin() }
    img.src = url
  })
}

/** Précharge en fond, une fois la page au calme, les images des types proposés (adresses
 *  rendues par `silhouettePour`) : le premier clic n'attend pas le réseau, sans retarder
 *  l'affichage de la page. */
export function prechargerSilhouettes(urls: readonly string[]) {
  if (typeof window === 'undefined') return
  const charger = () => {
    for (const url of urls) { const img = new Image(); img.src = url }
  }
  if ('requestIdleCallback' in window) window.requestIdleCallback(charger, { timeout: 2500 })
  else setTimeout(charger, 1200)
}

function Face({ image, masque, cote, reflet, dos }: { image: string; masque: CSSProperties; cote: React.Ref<HTMLDivElement>; reflet: React.Ref<HTMLDivElement>; dos?: boolean }) {
  return (
    <div ref={cote} className="wb-sv-face" style={{ transform: `translateZ(${dos ? -EPAISSEUR / 2 : EPAISSEUR / 2}px)`, visibility: dos ? 'hidden' : 'visible' }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- image statique, mise en couches 3D */}
      <img src={image} alt="" draggable={false} className="wb-sv-dessin" />
      <div ref={reflet} className="wb-sv-reflet" style={masque} />
    </div>
  )
}

export default function SilhouetteVehicule3D({ type, nom }: { type: string | null; nom?: string | null }) {
  const image = silhouettePour(type, nom)
  const scene = useRef<HTMLDivElement>(null)
  const objet = useRef<HTMLDivElement>(null)
  const ombre = useRef<HTMLDivElement>(null)
  const faceAvant = useRef<HTMLDivElement>(null)
  const faceArriere = useRef<HTMLDivElement>(null)
  const refletAvant = useRef<HTMLDivElement>(null)
  const refletArriere = useRef<HTMLDivElement>(null)
  const pointeur = useRef<{ x: number; y: number } | null>(null)
  const [nomVisible, setNomVisible] = useState(false)

  useEffect(() => {
    if (!image) return
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let vivant = true
    let raf = 0
    let visible = true
    let annonce = false
    let t0 = 0
    const DUREE = reduit ? 300 : 1500
    const m = { tx: 0, ty: 0 }

    const etape = (t: number) => {
      if (!vivant || !visible) { raf = 0; return }
      const el = objet.current
      if (!el) return
      if (!t0) t0 = t
      const p = Math.min(1, (t - t0) / DUREE)
      // Apparition : il arrive de biais, petit, fait un tour complet et se pose.
      let tour = 0, echelle = 1
      if (!reduit) {
        tour = p < 0.82 ? -110 + (368 + 110) * courbe.cubique(p / 0.82) : 368 - 8 * courbe.sortie((p - 0.82) / 0.18)
        echelle = 0.55 + 0.45 * courbe.rebond(Math.min(1, p / 0.6))
      }
      if (p >= 1 && !annonce) { annonce = true; setNomVisible(true) }
      // Ensuite : il flotte, se balance doucement, et suit la souris quand elle passe dessus.
      const repos = reduit ? 0 : Math.min(1, Math.max(0, (t - t0 - DUREE) / 600))
      const cx = pointeur.current ? pointeur.current.x : 0
      const cy = pointeur.current ? pointeur.current.y : Math.sin(t / 2100) * 9 * repos
      m.tx += (cx - m.tx) * 0.08
      m.ty += (cy - m.ty) * 0.08
      const flotte = Math.sin(t / 1400) * 3 * repos
      const angle = tour + m.ty
      el.style.opacity = String(Math.min(1, p * 3))
      el.style.transform = `translateY(${flotte.toFixed(2)}px) rotateX(${m.tx.toFixed(2)}deg) rotateY(${angle.toFixed(2)}deg) scale(${echelle.toFixed(3)})`
      const a = (angle * Math.PI) / 180
      // Une seule face à la fois, choisie ici plutôt que par `backface-visibility` : Safari
      // (iPhone) affiche quand même la face de dos à travers les zones transparentes de la
      // photo, et la voiture se voyait doublée de son reflet en miroir (2026-10-18).
      const deFace = Math.cos(a) >= 0
      if (faceAvant.current) faceAvant.current.style.visibility = deFace ? 'visible' : 'hidden'
      if (faceArriere.current) faceArriere.current.style.visibility = deFace ? 'hidden' : 'visible'
      // Le reflet balaie la carrosserie à mesure qu'elle tourne.
      const x = `${(50 - Math.sin(a) * 70).toFixed(1)}% 0`
      if (refletAvant.current) refletAvant.current.style.backgroundPosition = x
      if (refletArriere.current) refletArriere.current.style.backgroundPosition = x
      if (ombre.current) ombre.current.style.transform = `translateX(-50%) scaleX(${(0.4 + 0.6 * Math.abs(Math.cos(a))).toFixed(3)})`
      raf = requestAnimationFrame(etape)
    }
    const relancer = () => { if (!raf && vivant && visible) raf = requestAnimationFrame(etape) }

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
    // Le tour ne commence qu'une fois l'image prête : sinon il tournerait à vide.
    prete(image).then(() => { if (vivant) relancer() })
    return () => {
      vivant = false
      if (raf) cancelAnimationFrame(raf)
      io.disconnect()
      zone?.removeEventListener('pointermove', bouger)
      zone?.removeEventListener('pointerleave', quitter)
    }
  }, [image])

  // Avant le choix : la place reste réservée, une voiture estompée invite à choisir.
  if (!type) {
    return (
      <div className="wb-sv" aria-hidden>
        <div className="wb-sv-scene">
          {/* eslint-disable-next-line @next/next/no-img-element -- image statique */}
          <img src={silhouettePour('citadine')!} alt="" draggable={false} className="wb-sv-attente" />
        </div>
        <p className="wb-sv-nom">Choisissez votre véhicule</p>
      </div>
    )
  }
  // Un véhicule sans photo (moto, camping-car…) ou personnalisé : rien à montrer.
  if (!image) return null

  const masque: CSSProperties = { WebkitMaskImage: `url(${image})`, maskImage: `url(${image})` }
  const tranche = Array.from({ length: COUCHES }, (_, i) => -EPAISSEUR / 2 + 0.5 + (i * (EPAISSEUR - 1)) / (COUCHES - 1))

  return (
    <div className="wb-sv" role="img" aria-label={nom ? `Votre véhicule : ${nom}` : 'Votre véhicule'}>
      <div ref={scene} className="wb-sv-scene">
        <div ref={ombre} className="wb-sv-ombre" />
        <div ref={objet} className="wb-sv-objet" data-cache="oui" aria-hidden>
          {tranche.map((z, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- image statique, mise en couches 3D
            <img key={i} src={image} alt="" draggable={false} className="wb-sv-couche" style={{ transform: `translateZ(${z.toFixed(2)}px)` }} />
          ))}
          <Face image={image} masque={masque} cote={faceAvant} reflet={refletAvant} />
          <Face image={image} masque={masque} cote={faceArriere} reflet={refletArriere} dos />
        </div>
      </div>
      {nom && <p className="wb-sv-nom" data-visible={nomVisible ? 'oui' : 'non'}>{nom}</p>}
    </div>
  )
}

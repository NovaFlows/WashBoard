'use client'

import { useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as PointerEventReact, type Ref } from 'react'
import { teintesCarte, variablesCarte, type FinitionCarte } from '@/lib/carteFidelite'
import './carteFidelite3D.css'

// La carte de fidélité en 3D — maquette validée par Alexandre le 2026-10-18 (« on garde tout
// comme ça »). Elle apparaît, se retourne et reçoit son tampon ; on l'incline à la souris ou
// au doigt, on la touche pour la retourner. Tout tourne dans le navigateur du client : rien
// de plus côté serveur.
//
// Les scénarios suivent le parcours retenu (option C) :
// - `reservation` : juste après une réservation, un tampon EN ATTENTE se dessine (le vrai
//   arrive quand le laveur marque la prestation terminée) ;
// - `tampon` : le client ouvre le lien « Votre tampon est arrivé » — le tampon frappe la carte,
//   et la dernière case débloque la récompense ;
// - `consultation` : la carte est simplement montrée ;
// - `apercu` : l'écran de réglages du laveur, qui réagit tout de suite à ses choix.
// Pour rejouer un scénario, le parent change la `key` du composant. En aperçu, il peut aussi
// faire frapper un tampon sans tout rejouer (`ref` → `tamponner`, bouton « + » des réglages).

export type ScenarioCarte = 'consultation' | 'reservation' | 'tampon' | 'apercu'

type Props = {
  couleur: string
  finition: FinitionCarte
  nom: string
  /** Logo à la place de l'initiale — déjà choisi par le laveur et permis par son offre. */
  logo?: string | null
  numero?: string | null
  requis: number
  /** Tampons sur la carte une fois l'animation jouée (de 0 à `requis`). */
  tampons: number
  /** La récompense en deux mots (`recompenseCourte`). */
  recompense: string
  scenario: ScenarioCarte
  /** Phrase affichée sous la carte une fois l'animation jouée. */
  legende?: string | null
  /** Largeur maximale de la carte, en pixels. */
  largeur?: number
  halo?: boolean
  ref?: Ref<CommandesCarte>
}

/** Commandes de l'aperçu (réglages du laveur). */
export type CommandesCarte = {
  /** Fait frapper le tampon de la case `index` (comptée depuis 0), qui vient d'être ajouté à
   *  `tampons` ; la dernière case débloque la récompense, avec sa fête. */
  tamponner: (index: number, requis: number) => void
}

type Fantome = 'non' | 'dessine' | 'fixe'
type Goutte = { x: number; y: number; t: number }
type Particule = { x: number; y: number; vx: number; vy: number; r: number; vie: number; g: number; bulle: boolean; fin?: number }
type Moteur = { retourner: () => void } & CommandesCarte

const courbes = {
  lin: (p: number) => p,
  sortieCubique: (p: number) => 1 - Math.pow(1 - p, 3),
  cubique: (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  rebond: (p: number) => { const c1 = 1.35, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2) },
}
const borne = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/** Rangées du verso : une seule jusqu'à 6 tampons, deux jusqu'à 14, trois au-delà. */
function disposition(n: number) {
  const rangs = n <= 6 ? 1 : n <= 14 ? 2 : 3
  return { cols: Math.ceil(n / rangs), rangs }
}

export default function CarteFidelite3D({ couleur, finition, nom, logo, numero, requis, tampons, recompense, scenario, legende, largeur = 360, halo = true, ref }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const idEncre = `wb-cf-encre-${uid}`
  const idOr = `wb-cf-or-${uid}`
  const final = borne(Math.round(tampons), 0, requis)

  const [pleins, setPleins] = useState(() => (scenario === 'tampon' ? Math.max(0, final - 1) : final))
  const [fantome, setFantome] = useState<Fantome>(() => (scenario === 'tampon' && final > 0 ? 'fixe' : 'non'))
  const [frappe, setFrappe] = useState<number | null>(null)
  const [gouttes, setGouttes] = useState<Goutte[]>([])
  const [saut, setSaut] = useState(0)
  const [legendeVisible, setLegendeVisible] = useState(scenario === 'apercu')

  // L'aperçu des réglages suit les choix du laveur à chaque instant ; les autres scénarios
  // partent de leur état de départ et avancent avec l'animation.
  const nPleins = scenario === 'apercu' ? final : pleins
  const complet = nPleins >= requis

  const racine = useRef<HTMLDivElement>(null)
  const entree = useRef<HTMLDivElement>(null)
  const pivot = useRef<HTMLDivElement>(null)
  const carte = useRef<HTMLDivElement>(null)
  const ombre = useRef<HTMLDivElement>(null)
  const toile = useRef<HTMLCanvasElement>(null)
  const grille = useRef<HTMLDivElement>(null)
  const moteur = useRef<Moteur | null>(null)
  const teinte = useRef(teintesCarte(couleur).lueur)
  const depart = useRef({ scenario, final, requis })
  const geste = useRef({ pointeur: null as { x: number; y: number } | null, glisse: false, deplacement: 0, dernier: null as { x: number; y: number } | null })

  useEffect(() => { teinte.current = teintesCarte(couleur).lueur }, [couleur])
  useImperativeHandle(ref, () => ({ tamponner: (index, req) => moteur.current?.tamponner(index, req) }), [])

  // Taille des cases du verso : la plus grande qui tient dans le panneau.
  useLayoutEffect(() => {
    const g = grille.current
    if (!g) return
    const { cols, rangs } = disposition(requis)
    const mesurer = () => {
      const w = g.clientWidth, h = g.clientHeight
      if (!w || !h) return
      const gap = w * 0.028
      const taille = Math.min((w - gap * (cols - 1)) / cols, (h - gap * (rangs - 1)) / rangs)
      g.style.gridTemplateColumns = `repeat(${cols}, ${taille.toFixed(1)}px)`
      g.style.gap = `${gap.toFixed(1)}px`
      g.style.setProperty('--case', `${taille.toFixed(1)}px`)
    }
    mesurer()
    const ro = new ResizeObserver(mesurer)
    ro.observe(g)
    return () => ro.disconnect()
  }, [requis])

  // Le moteur : inclinaison, rotation, reflets et particules, image par image, et le scénario.
  useEffect(() => {
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const { scenario: sc, final: fin, requis: req } = depart.current
    const m = { spin: 0, tx: 0, ty: 0, choc: 0, chocX: 0, hb: 0, verrou: false, visible: true, particules: [] as Particule[] }
    let vivant = true
    let raf = 0
    const ctx = toile.current?.getContext('2d') ?? null

    const tween = (duree: number, courbe: (p: number) => number, cb: (e: number, p: number) => void) => new Promise<void>(resoudre => {
      if (reduit || !vivant) { if (vivant) cb(1, 1); resoudre(); return }
      const t0 = performance.now()
      const pas = (t: number) => {
        if (!vivant) { resoudre(); return }
        const p = Math.min(1, (t - t0) / duree)
        cb(courbe(p), p)
        if (p < 1) requestAnimationFrame(pas); else resoudre()
      }
      requestAnimationFrame(pas)
    })
    const attente = (ms: number) => new Promise<void>(r => setTimeout(r, reduit ? 0 : ms))

    const tourner = async (cible: number, duree = 1150) => {
      const de = m.spin, depasse = cible + (cible > de ? 9 : -9)
      await tween(duree, courbes.cubique, e => { m.spin = de + (depasse - de) * e })
      await tween(420, courbes.sortieCubique, e => { m.spin = depasse + (cible - depasse) * e })
      m.spin = cible
    }
    const apparaitre = () => tween(950, courbes.lin, (_, p) => {
      const el = entree.current
      if (!el) return
      const e = courbes.rebond(p), d = courbes.sortieCubique(p)
      el.style.opacity = String(Math.min(1, p * 2.2))
      el.style.transform = `translateY(${((1 - e) * 90).toFixed(1)}px) scale(${(0.68 + 0.32 * e).toFixed(3)}) rotateX(${((1 - d) * 52).toFixed(1)}deg) rotateZ(${((1 - d) * -11).toFixed(1)}deg)`
    }).then(() => { if (entree.current) { entree.current.style.transform = ''; entree.current.style.opacity = '1' } })
    const secousse = () => tween(480, courbes.lin, (_, p) => {
      const amorti = 1 - p
      m.choc = Math.sin(p * Math.PI * 2.2) * amorti * 6
      m.chocX = Math.sin(p * Math.PI * 3) * amorti * 3.2
    }).then(() => { m.choc = 0; m.chocX = 0 })

    // ── Particules : gouttes au moment du tampon, bulles quand la carte est complète ──
    const taillerToile = () => {
      const t = toile.current, r = racine.current
      if (!t || !r || !ctx) return
      const dpr = window.devicePixelRatio || 1
      t.width = r.clientWidth * dpr
      t.height = r.clientHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const eclabousser = (x: number, y: number) => {
      if (reduit) return
      for (let i = 0; i < 18; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5, v = 2.5 + Math.random() * 4.5
        m.particules.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, r: 1.4 + Math.random() * 2.8, vie: 1, g: 0.22, bulle: Math.random() < 0.3 })
      }
    }
    const bulles = () => {
      const r = racine.current
      if (reduit || !r) return
      const w = r.clientWidth, h = r.clientHeight
      for (let i = 0; i < 46; i++) {
        m.particules.push({ x: Math.random() * w, y: h + Math.random() * 120, vx: (Math.random() - 0.5) * 0.6, vy: -(1.4 + Math.random() * 2.6), r: 3 + Math.random() * 11, vie: 1, g: -0.004, bulle: true, fin: h * (0.08 + Math.random() * 0.6) })
      }
    }
    const dessinerParticules = () => {
      const r = racine.current
      if (!ctx || !r) return
      ctx.clearRect(0, 0, r.clientWidth, r.clientHeight)
      if (!m.particules.length) return
      const c = teinte.current
      m.particules = m.particules.filter(p => p.vie > 0)
      for (const p of m.particules) {
        p.vy += p.g; p.x += p.vx; p.y += p.vy
        if (p.fin !== undefined) { if (p.y < p.fin) p.vie -= 0.07 } else p.vie -= 0.022
        const a = Math.max(0, p.vie)
        ctx.globalAlpha = a
        if (!p.bulle) {
          const g = ctx.createRadialGradient(p.x - p.r * 0.3, p.y - p.r * 0.3, 0, p.x, p.y, p.r)
          g.addColorStop(0, '#ffffff'); g.addColorStop(1, c)
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill()
        } else {
          ctx.strokeStyle = c; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke()
          ctx.globalAlpha = a * 0.14; ctx.fillStyle = c; ctx.fill()
          ctx.globalAlpha = a * 0.85; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.22, 0, Math.PI * 2); ctx.fill()
        }
      }
      ctx.globalAlpha = 1
    }

    // ── Boucle d'affichage ; arrêtée quand la carte sort de l'écran ──
    const boucle = (t: number) => {
      if (!vivant || !m.visible) { raf = 0; return }
      const g = geste.current
      const cx = g.pointeur ? g.pointeur.x : reduit ? 0 : Math.sin(t / 1700) * 3.5
      const cy = g.pointeur ? g.pointeur.y : reduit ? 0 : Math.cos(t / 2300) * 6
      m.tx += (cx - m.tx) * 0.1
      m.ty += (cy - m.ty) * 0.1
      const flotte = reduit ? 0 : Math.sin(t / 1300) * 4
      if (pivot.current) pivot.current.style.transform = `translateY(${(flotte + m.choc).toFixed(2)}px) rotateX(${(m.tx + m.chocX).toFixed(2)}deg) rotateY(${m.ty.toFixed(2)}deg)`
      const c = carte.current
      if (c) {
        c.style.transform = `rotateY(${m.spin.toFixed(2)}deg)`
        const a = m.spin * Math.PI / 180
        c.style.setProperty('--gx', `${(50 + m.ty * 3.2 + Math.sin(2 * a) * 78).toFixed(1)}%`)
        c.style.setProperty('--gy', `${(42 - m.tx * 3.2).toFixed(1)}%`)
        c.style.setProperty('--go', Math.min(1, 0.42 + Math.abs(m.ty) / 28 + Math.abs(m.tx) / 28 + Math.abs(Math.sin(2 * a)) * 0.5).toFixed(3))
        c.style.setProperty('--hx', (m.ty * 7 + m.tx * 4 + m.spin * 0.9).toFixed(1))
        c.style.setProperty('--hb', m.hb.toFixed(3))
        if (ombre.current) {
          ombre.current.style.transform = `translateX(-50%) scaleX(${(0.38 + 0.62 * Math.abs(Math.cos(a))).toFixed(3)}) scaleY(${(1 - flotte * 0.03).toFixed(3)})`
          ombre.current.style.opacity = (0.85 - flotte * 0.04).toFixed(3)
        }
      }
      dessinerParticules()
      raf = requestAnimationFrame(boucle)
    }
    const relancer = () => { if (!raf && vivant && m.visible) raf = requestAnimationFrame(boucle) }

    const io = new IntersectionObserver(([e]) => { m.visible = e.isIntersecting; relancer() })
    if (racine.current) io.observe(racine.current)
    const ro = new ResizeObserver(taillerToile)
    if (racine.current) ro.observe(racine.current)
    taillerToile()
    relancer()

    const frapper = async (i: number) => {
      setGouttes(Array.from({ length: 3 }, () => {
        const ang = Math.random() * Math.PI * 2, dist = 52 + Math.random() * 14
        return { x: Math.cos(ang) * dist, y: Math.sin(ang) * dist, t: 1.6 + Math.random() * 2.2 }
      }))
      setFrappe(i)
      setFantome('non')
      await attente(360)
      if (!vivant) return
      // Android seulement, et une fois que le client a touché la page (sinon Chrome refuse).
      const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation
      if (activation?.hasBeenActive) { try { navigator.vibrate?.([16, 30, 10]) } catch { /* pas de vibreur : rien */ } }
      const caseEl = grille.current?.children[i] as HTMLElement | undefined
      const r = racine.current
      if (caseEl && r) {
        const rc = caseEl.getBoundingClientRect(), rr = r.getBoundingClientRect()
        eclabousser(rc.left + rc.width / 2 - rr.left, rc.top + rc.height / 2 - rr.top)
      }
      secousse()
      setPleins(i + 1)
      setSaut(s => s + 1)
      await attente(420)
    }
    const celebrer = async () => {
      bulles()
      tween(600, courbes.sortieCubique, e => { m.hb = e })
      await tourner(m.spin + 360, 1500)
      await tween(900, courbes.sortieCubique, e => { m.hb = 1 - e * 0.6 })
    }

    const verso = () => Math.round(m.spin / 180) % 2 !== 0
    moteur.current = {
      retourner: () => {
        if (m.verrou) return
        m.verrou = true
        tourner(m.spin + 180, 900).then(() => { m.verrou = false })
      },
      tamponner: async (i, requisActuel) => {
        // Attendre la fin d'un retournement en cours, puis montrer le verso s'il est caché.
        for (let n = 0; m.verrou && vivant && n < 40; n++) await attente(80)
        if (!vivant) return
        if (!verso()) {
          m.verrou = true
          await tourner(m.spin + 180, 900)
          m.verrou = false
        }
        await frapper(i)
        if (vivant && i + 1 >= requisActuel) {
          m.verrou = true
          await celebrer()
          m.verrou = false
        }
      },
    }

    const jouer = async () => {
      m.verrou = true
      if (sc === 'apercu') {
        await attente(900)
        if (!vivant) return
        await tourner(180, 1300)
        m.verrou = false
        return
      }
      await apparaitre()
      if (!vivant) return
      await attente(250)
      if (!vivant) return
      await tourner(180)
      if (!vivant) return
      if (sc === 'tampon' && fin > 0) {
        await attente(380)
        if (!vivant) return
        await frapper(fin - 1)
        if (!vivant) return
        setLegendeVisible(true)
        if (fin >= req) await celebrer()
      } else {
        if (sc === 'reservation' && fin < req) setFantome('dessine')
        setLegendeVisible(true)
      }
      m.verrou = false
    }
    jouer()

    return () => {
      vivant = false
      if (raf) cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
      moteur.current = null
    }
  }, [])

  // ── Gestes : incliner (souris au survol, doigt en glissant), toucher pour retourner ──
  const incliner = (e: PointerEventReact) => {
    const g = geste.current
    if (e.pointerType !== 'mouse' && !g.glisse) return
    const r = entree.current?.getBoundingClientRect()
    if (!r) return
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2)
    const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2)
    g.pointeur = { x: borne(-dy * 14, -16, 16), y: borne(dx * 18, -22, 22) }
    if (g.glisse && g.dernier) g.deplacement += Math.abs(e.clientX - g.dernier.x) + Math.abs(e.clientY - g.dernier.y)
    g.dernier = { x: e.clientX, y: e.clientY }
  }
  const relacher = (e: PointerEventReact, annule: boolean) => {
    const g = geste.current
    const tape = !annule && g.glisse && g.deplacement < 8
    g.glisse = false
    g.dernier = null
    if (e.pointerType !== 'mouse') g.pointeur = null
    if (tape) moteur.current?.retourner()
  }

  const style = { ...variablesCarte(couleur), '--wb-cf-max': `${largeur}px` } as CSSProperties
  const initiale = (nom.trim().charAt(0) || 'W').toUpperCase()
  const dansLaPhrase = recompense.charAt(0).toLowerCase() + recompense.slice(1)
  const libelleCases = `${nPleins} tampon${nPleins > 1 ? 's' : ''} sur ${requis}`

  return (
    <div ref={racine} className="wb-cf" style={style} data-halo={halo ? 'oui' : 'non'}
      onPointerMove={incliner}
      onPointerLeave={() => { if (!geste.current.glisse) geste.current.pointeur = null }}>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        <defs>
          <linearGradient id={idOr} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#F3D27A" /><stop offset=".45" stopColor="#C8921C" /><stop offset=".7" stopColor="#FBE6A8" /><stop offset="1" stopColor="#94640A" />
          </linearGradient>
          <filter id={idEncre} x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="1.3" numOctaves={2} seed={4} result="b" />
            <feDisplacementMap in="SourceGraphic" in2="b" scale="1.7" />
          </filter>
        </defs>
      </svg>

      <div className="wb-cf-scene">
        <div ref={ombre} className="wb-cf-ombre" aria-hidden />
        <div ref={entree} className="wb-cf-entree" data-cache={scenario === 'apercu' ? 'non' : 'oui'}
          role="button" tabIndex={0} aria-label={`Carte de fidélité ${nom}, ${libelleCases}. Retourner la carte`}
          onPointerDown={e => { const g = geste.current; g.glisse = true; g.deplacement = 0; g.dernier = { x: e.clientX, y: e.clientY }; incliner(e) }}
          onPointerUp={e => relacher(e, false)}
          onPointerCancel={e => relacher(e, true)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); moteur.current?.retourner() } }}>
          <div ref={pivot} className="wb-cf-pivot">
            <div ref={carte} className="wb-cf-carte" data-finition={finition}>
              {Array.from({ length: 10 }, (_, i) => (
                <div key={i} className="wb-cf-couche" style={{ transform: `translateZ(${(-1.6 + i * (3.2 / 9)).toFixed(2)}px)` }} />
              ))}

              <div className="wb-cf-face">
                <div className="wb-cf-fond" /><div className="wb-cf-lignes" /><div className="wb-cf-grain" />
                <div className="wb-cf-patch" aria-hidden>
                  <svg viewBox="0 0 24 24"><path d="M12 2.5c4.3 5.4 6.6 9.1 6.6 12.3a6.6 6.6 0 0 1-13.2 0c0-3.2 2.3-6.9 6.6-12.3z" fill="#fff" /></svg>
                </div>
                <div className="wb-cf-recto-contenu">
                  <div className="wb-cf-haut">
                    <div className="wb-cf-logo" aria-hidden>
                      {/* eslint-disable-next-line @next/next/no-img-element -- logo du laveur (Supabase), taille libre */}
                      {logo ? <img src={logo} alt="" draggable={false} /> : initiale}
                    </div>
                    <div className="wb-cf-ident">
                      <div className="wb-cf-nom">{nom}</div>
                      <div className="wb-cf-sous">Carte de fidélité</div>
                    </div>
                    {numero && <div className="wb-cf-numero">N° {numero}</div>}
                  </div>
                  <div className="wb-cf-bas">
                    <div style={{ minWidth: 0 }}>
                      <span className="wb-cf-lbl">Récompense</span>
                      <span className="wb-cf-val">{recompense}</span>
                    </div>
                    <div className="wb-cf-compte">
                      <span className="wb-cf-lbl">Tampons</span>
                      <span key={saut} className={`wb-cf-val wb-cf-gros${saut ? ' wb-cf-saute' : ''}`}>{nPleins}/{requis}</span>
                    </div>
                  </div>
                </div>
                <div className="wb-cf-holo" /><div className="wb-cf-paillettes" /><div className="wb-cf-reflet" /><div className="wb-cf-arete" />
              </div>

              <div className="wb-cf-face wb-cf-verso">
                <div className="wb-cf-fond" /><div className="wb-cf-lignes" /><div className="wb-cf-grain" />
                <div className="wb-cf-bande" />
                <div className="wb-cf-panneau" data-complet={complet ? 'oui' : 'non'}>
                  <div className="wb-cf-panneau-titre">Vos tampons <span key={saut} className={saut ? 'wb-cf-saute' : ''}>{nPleins} / {requis}</span></div>
                  <div ref={grille} className="wb-cf-grille" aria-label={libelleCases} role="img">
                    {Array.from({ length: requis }, (_, i) => {
                      const dore = i === requis - 1
                      const tamponne = i < nPleins || (i === frappe && scenario !== 'apercu')
                      const enFrappe = tamponne && i === frappe
                      return (
                        <div key={i} className="wb-cf-case">
                          {tamponne
                            ? <Tampon i={i} dore={dore} frappe={enFrappe} idEncre={idEncre} idOr={idOr} />
                            : i === nPleins && fantome !== 'non' && scenario !== 'apercu'
                              ? <TamponEnAttente dessine={fantome === 'dessine'} />
                              : <CaseVide n={i + 1} cadeau={dore} />}
                          {enFrappe && (
                            <>
                              <span className="wb-cf-onde" />
                              {gouttes.map((g, k) => (
                                <span key={k} className="wb-cf-goutte" style={{ left: `calc(50% + ${g.x.toFixed(0)}% - ${g.t / 2}px)`, top: `calc(50% + ${g.y.toFixed(0)}% - ${g.t / 2}px)`, width: `${g.t.toFixed(1)}px`, height: `${g.t.toFixed(1)}px` }} />
                              ))}
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <div className="wb-cf-recompense">{complet ? `★ Récompense débloquée : ${dansLaPhrase}` : `Au ${requis}e tampon : ${dansLaPhrase}`}</div>
                </div>
                <div className="wb-cf-holo" /><div className="wb-cf-reflet" /><div className="wb-cf-arete" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <canvas ref={toile} className="wb-cf-particules" aria-hidden />
      {legende && <p className="wb-cf-legende" aria-live="polite" data-visible={legendeVisible ? 'oui' : 'non'}>{legende}</p>}
    </div>
  )
}

function Tampon({ i, dore, frappe, idEncre, idOr }: { i: number; dore: boolean; frappe: boolean; idEncre: string; idOr: string }) {
  const style = { '--r': `${((i * 37) % 29) - 14}deg` } as CSSProperties
  if (dore) {
    // La case de la récompense : un tampon doré avec un cadeau, pas une goutte.
    return (
      <svg className={`wb-cf-tampon wb-cf-dore${frappe ? ' wb-cf-frappe' : ''}`} viewBox="0 0 40 40" style={style} aria-hidden>
        <circle cx="20" cy="20" r="18" fill="none" stroke={`url(#${idOr})`} strokeWidth="1.8" />
        <circle cx="20" cy="20" r="14.6" fill={`url(#${idOr})`} />
        <rect x="13.6" y="19" width="12.8" height="8.6" rx="1.2" fill="#FFF8E6" />
        <rect x="12.6" y="15.8" width="14.8" height="3.6" rx="1" fill="#FFF8E6" />
        <path d="M20 15.8v11.8" stroke="#B9851A" strokeWidth="1.7" />
        <path d="M20 15.8c-1.6-3.7-5.3-3.4-4.7-1.2.4 1.5 4.7 1.2 4.7 1.2zm0 0c1.6-3.7 5.3-3.4 4.7-1.2-.4 1.5-4.7 1.2-4.7 1.2z" fill="#FFF8E6" />
      </svg>
    )
  }
  return (
    <svg className={`wb-cf-tampon${frappe ? ' wb-cf-frappe' : ''}`} viewBox="0 0 40 40" style={style} aria-hidden>
      <g filter={`url(#${idEncre})`}>
        <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="20" cy="20" r="14.6" fill="currentColor" />
        <path d="M20 9.6c3.9 4.9 6 8.3 6 11.2a6 6 0 0 1-12 0c0-2.9 2.1-6.3 6-11.2z" fill="#F6F3EC" />
        <path d="M28.2 11l.85 2 2 .85-2 .85-.85 2-.85-2-2-.85 2-.85z" fill="#F6F3EC" />
      </g>
    </svg>
  )
}

// Les chiffres sont du texte HTML posé sur le cercle, pas du `<text>` SVG : dans une carte en
// 3D, Chrome dessinait le texte SVG décalé et trop gros (vu en capture le 2026-10-18, alors que
// sa position mesurée était juste).
function TamponEnAttente({ dessine }: { dessine: boolean }) {
  return (
    <>
      <svg className={`wb-cf-fantome${dessine ? ' wb-cf-dessine' : ''}`} viewBox="0 0 40 40" aria-hidden>
        <circle className="wb-cf-anneau" cx="20" cy="20" r="16" pathLength={100} />
      </svg>
      <span className="wb-cf-num wb-cf-plus" data-dessine={dessine ? 'oui' : 'non'} aria-hidden>+1</span>
    </>
  )
}

function CaseVide({ n, cadeau }: { n: number; cadeau: boolean }) {
  return (
    <>
      <svg className="wb-cf-vide" viewBox="0 0 40 40" aria-hidden>
        <circle cx="20" cy="20" r="16" />
        {cadeau && (
          <>
            <rect className="wb-cf-trait" x="13" y="18" width="14" height="10" rx="1.5" />
            <path className="wb-cf-trait" d="M12 15h16v3H12zM20 15v13M20 15c-2-4-6-3.5-5-1s5 1 5 1c2-4 6-3.5 5-1s-5 1-5 1" />
          </>
        )}
      </svg>
      {!cadeau && <span className="wb-cf-num" aria-hidden>{n}</span>}
    </>
  )
}

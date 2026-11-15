'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Gift, X } from 'lucide-react'
import { useT } from '@/components/i18n/I18nProvider'

type Celebration = { filleul: string; phrase: string }

const police = '[font-family:var(--font-archivo)]'
const corps = `${police} [font-weight:var(--v2-type-corps-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const corpsFort = `${police} [font-weight:var(--v2-type-corps-fort-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const titre = `${police} [font-weight:var(--v2-type-titre-poids)] [font-stretch:var(--v2-type-titre-largeur)] tracking-[var(--v2-type-titre-tracking)]`

function signaler(action: 'fermer_carte' | 'celebre') {
  fetch('/api/parrainage/accueil', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  }).catch(() => {})
}

function animationsReduites() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** Carte de rappel (sous le prochain rendez-vous) et célébration d'un filleul devenu client. */
export default function ParrainageAccueilV2() {
  const [carte, setCarte] = useState(false)
  const [sortie, setSortie] = useState(false)
  const [celebration, setCelebration] = useState<Celebration | null>(null)

  useEffect(() => {
    let actif = true
    fetch('/api/parrainage/accueil')
      .then(r => (r.ok ? r.json() : null))
      .then((d: { carte: boolean; celebration: Celebration | null } | null) => {
        if (!actif || !d) return
        setCarte(d.carte)
        setCelebration(d.celebration)
      })
      .catch(() => {})
    return () => { actif = false }
  }, [])

  function fermerCarte() {
    signaler('fermer_carte')
    if (animationsReduites()) { setCarte(false); return }
    setSortie(true)
    setTimeout(() => setCarte(false), 250)
  }

  function fermerCelebration() {
    signaler('celebre')
    setCelebration(null)
  }

  return (
    <>
      {carte && <CarteRappel sortie={sortie} onFermer={fermerCarte} />}
      {celebration && <FenetreCelebration celebration={celebration} onFermer={fermerCelebration} />}
    </>
  )
}

function CarteRappel({ sortie, onFermer }: { sortie: boolean; onFermer: () => void }) {
  const t = useT()
  return (
    <div
      className="mt-4 flex items-center gap-1 rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] pl-3.5 transition-[opacity,transform] duration-[250ms] ease-out"
      style={sortie ? { opacity: 0, transform: 'translateX(24px)' } : undefined}
    >
      <Link href="/dashboard/parrainage" className="flex min-w-0 flex-1 items-center gap-3 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]" style={{ background: 'color-mix(in srgb, var(--v2-color-accent) 14%, transparent)', color: 'var(--v2-color-accent)' }} aria-hidden>
          <Gift size={18} />
        </span>
        <span className="min-w-0">
          <span className={`block text-[14px] leading-snug ${corpsFort}`}>{t('Parrainez un collègue, gagnez 1 mois offert')}</span>
          <span className={`block text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>{t('Il a 2 semaines d’essai en plus.')}</span>
        </span>
      </Link>
      <button
        type="button"
        onClick={onFermer}
        aria-label={t('Fermer')}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[color:var(--v2-color-gris)] hover:bg-[color:var(--v2-filet)]"
      >
        <X size={18} />
      </button>
    </div>
  )
}

function FenetreCelebration({ celebration, onFermer }: { celebration: Celebration; onFermer: () => void }) {
  const t = useT()
  const toile = useRef<HTMLCanvasElement>(null)
  const bouton = useRef<HTMLButtonElement>(null)
  const fermer = useRef(onFermer)
  useEffect(() => { fermer.current = onFermer }, [onFermer])

  useEffect(() => {
    bouton.current?.focus()
    const echap = (e: KeyboardEvent) => { if (e.key === 'Escape') fermer.current() }
    window.addEventListener('keydown', echap)
    const cv = toile.current
    const arret = cv && !animationsReduites() ? lancerConfettis(cv) : undefined
    return () => { window.removeEventListener('keydown', echap); arret?.() }
  }, [])

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 px-4" role="dialog" aria-modal="true" aria-labelledby="celebration-titre">
      <canvas ref={toile} className="pointer-events-none fixed inset-0 h-full w-full" aria-hidden />
      <div className={`relative w-full max-w-[380px] rounded-[var(--v2-radius-surface)] bg-[color:var(--v2-color-surface)] px-5 pb-5 pt-6 text-center text-[color:var(--v2-color-encre)] ${police}`}>
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--v2-color-gris)]">{t('Parrainage')}</p>
        <h2 id="celebration-titre" className={`mt-2 text-[21px] leading-tight ${titre}`}>
          {t('{filleul} est devenu client', { filleul: celebration.filleul })}
        </h2>
        <p className={`mt-1 text-[16px] ${corpsFort}`} style={{ color: 'var(--v2-color-vert)' }}>{t('Votre mois est offert')}</p>
        {celebration.phrase && <p className={`mt-2 text-[13.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>{celebration.phrase}</p>}
        <button
          ref={bouton}
          type="button"
          onClick={onFermer}
          className={`mt-5 min-h-[48px] w-full rounded-[var(--v2-radius-bouton)] bg-[color:var(--v2-color-accent)] text-[15px] ${corpsFort} text-[color:var(--v2-color-sur-accent)]`}
        >
          {t('Super')}
        </button>
        <Link href="/dashboard/parrainage" onClick={onFermer} className={`mt-2 inline-flex min-h-[40px] items-center text-[13.5px] ${corps} text-[color:var(--v2-color-gris)] underline underline-offset-[3px]`}>
          {t('Voir mon parrainage')}
        </Link>
      </div>
    </div>
  )
}

/** Petits rectangles aux couleurs de WashBoard, environ 4 secondes, puis la toile se vide. */
function lancerConfettis(cv: HTMLCanvasElement): () => void {
  const ctx = cv.getContext('2d')
  if (!ctx) return () => {}
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const l = cv.clientWidth, h = cv.clientHeight
  cv.width = l * dpr
  cv.height = h * dpr
  ctx.scale(dpr, dpr)
  const style = getComputedStyle(document.documentElement)
  const couleurs = ['--v2-color-accent', '--v2-color-vert', '--v2-color-ambre', '--v2-color-encre']
    .map(v => style.getPropertyValue(v).trim() || '#1651E8')
  const pieces = Array.from({ length: 140 }, () => ({
    x: Math.random() * l,
    y: -20 - Math.random() * h * 0.5,
    vx: (Math.random() - 0.5) * 2.4,
    vy: 2 + Math.random() * 3.5,
    a: Math.random() * Math.PI,
    va: (Math.random() - 0.5) * 0.3,
    w: 6 + Math.random() * 5,
    hh: 3 + Math.random() * 4,
    c: couleurs[Math.floor(Math.random() * couleurs.length)],
  }))
  const debut = performance.now()
  let id = 0
  const image = (tps: number) => {
    const ecoule = tps - debut
    ctx.clearRect(0, 0, l, h)
    ctx.globalAlpha = ecoule > 3200 ? Math.max(0, 1 - (ecoule - 3200) / 800) : 1
    for (const p of pieces) {
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.03
      p.a += p.va
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.a)
      ctx.fillStyle = p.c
      ctx.fillRect(-p.w / 2, -p.hh / 2, p.w, p.hh)
      ctx.restore()
    }
    if (ecoule < 4000) id = requestAnimationFrame(image)
    else ctx.clearRect(0, 0, l, h)
  }
  id = requestAnimationFrame(image)
  return () => cancelAnimationFrame(id)
}

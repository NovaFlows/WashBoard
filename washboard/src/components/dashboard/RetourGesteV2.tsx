'use client'

import { useEffect, useRef } from 'react'
import { ChevronLeft } from 'lucide-react'

// « Glisser vers la droite pour revenir », n'importe où sur l'écran, comme Instagram
// (Alexandre, 2026-09-30 : le geste de l'iPhone ne marche que depuis le bord, trop précis).
//
// Le geste ne sait pas où « revenir » : chaque écran a déjà son bouton retour (« Retour à
// Plus », « Retour à Clients », « Retour à la semaine »…), qui mène à SON parent. On déclenche
// ce bouton — même destination que le tap, jamais un `history.back()` qui ferait sortir vers un
// autre onglet. Pas de bouton retour à l'écran (Aujourd'hui, Agenda, Clients, Plus) : rien ne
// se passe.
//
// Ce qui ne déclenche PAS le geste : un départ à moins de 24 px du bord gauche (l'iPhone fait
// déjà son retour natif, on ne le double pas), un champ de saisie, une zone qui défile
// horizontalement (bandeau des jours, filtres), un graphique (`data-no-swipe-back`), et tout
// geste plus vertical qu'horizontal (le défilement reste roi).

const BORD_NATIF_PX = 24
const VERROU_PX = 10
const DECLENCHE_PX = 80
const RATIO_HORIZONTAL = 1.6
const MAX_PX = 90

function defileEnHorizontal(el: Element | null): boolean {
  for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) {
    if (n.hasAttribute('data-no-swipe-back')) return true
    const overflowX = getComputedStyle(n).overflowX
    if ((overflowX === 'auto' || overflowX === 'scroll') && n.scrollWidth > n.clientWidth + 1) return true
  }
  return false
}

function estVisible(el: Element): boolean {
  return el.getClientRects().length > 0 && !el.closest('[aria-hidden="true"], [inert]')
}

/** Le bouton retour de l'écran (ou de la superposition) ouvert au premier plan. */
function boutonRetour(): HTMLElement | null {
  const tous = [...document.querySelectorAll<HTMLElement>('a[aria-label^="Retour"], button[aria-label^="Retour"]')]
    .filter(estVisible)
  const cible = tous[tous.length - 1] ?? null
  const feuille = document.querySelector('[role="dialog"][aria-modal="true"]')
  // Une feuille du bas est ouverte : elle a sa propre poignée, le geste ne doit pas naviguer dessous.
  if (feuille && !(cible && feuille.contains(cible))) return null
  return cible
}

export default function RetourGesteV2() {
  const pastille = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let depart: { x: number; y: number } | null = null
    let verrou: 'horizontal' | 'abandon' | null = null

    const montrer = (progres: number, y: number) => {
      const p = pastille.current
      if (!p) return
      p.style.opacity = String(Math.min(1, progres * 1.4))
      p.style.top = `${y - 22}px`
      p.style.transform = `translateX(${Math.min(progres, 1) * 52 - 44}px) scale(${0.7 + Math.min(progres, 1) * 0.3})`
    }
    const cacher = () => {
      const p = pastille.current
      if (!p) return
      p.style.opacity = '0'
      p.style.transform = 'translateX(-44px) scale(.7)'
    }

    const debut = (e: TouchEvent) => {
      depart = null
      verrou = null
      if (e.touches.length !== 1) return
      const t = e.touches[0]
      if (t.clientX < BORD_NATIF_PX) return
      const cible = e.target instanceof Element ? e.target : null
      if (cible?.closest('input, textarea, select, [contenteditable="true"]')) return
      if (defileEnHorizontal(cible)) return
      if (!boutonRetour()) return
      depart = { x: t.clientX, y: t.clientY }
    }

    const mouvement = (e: TouchEvent) => {
      if (!depart || verrou === 'abandon') return
      const t = e.touches[0]
      const dx = t.clientX - depart.x
      const dy = t.clientY - depart.y
      if (verrou === null) {
        if (Math.abs(dx) < VERROU_PX && Math.abs(dy) < VERROU_PX) return
        verrou = dx > 0 && Math.abs(dx) > Math.abs(dy) * RATIO_HORIZONTAL ? 'horizontal' : 'abandon'
        if (verrou === 'abandon') { cacher(); return }
      }
      montrer(Math.max(0, dx) / MAX_PX, t.clientY)
    }

    const fin = (e: TouchEvent) => {
      const d = depart
      const v = verrou
      depart = null
      verrou = null
      cacher()
      if (!d || v !== 'horizontal') return
      const t = e.changedTouches[0]
      if (t.clientX - d.x < DECLENCHE_PX) return
      boutonRetour()?.click()
    }

    const annule = () => { depart = null; verrou = null; cacher() }

    document.addEventListener('touchstart', debut, { passive: true })
    document.addEventListener('touchmove', mouvement, { passive: true })
    document.addEventListener('touchend', fin, { passive: true })
    document.addEventListener('touchcancel', annule, { passive: true })
    return () => {
      document.removeEventListener('touchstart', debut)
      document.removeEventListener('touchmove', mouvement)
      document.removeEventListener('touchend', fin)
      document.removeEventListener('touchcancel', annule)
    }
  }, [])

  return (
    <div
      ref={pastille}
      aria-hidden
      style={{ opacity: 0, transform: 'translateX(-44px) scale(.7)', transition: 'opacity 160ms var(--v2-ease-out)' }}
      className="pointer-events-none fixed left-0 top-0 z-[60] flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] text-[color:var(--v2-color-encre)] shadow-[0_6px_18px_rgba(0,0,0,.16)]"
    >
      <ChevronLeft size={22} strokeWidth={2.2} />
    </div>
  )
}

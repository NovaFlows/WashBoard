'use client'

import { useRef, useEffect } from 'react'
import type { GoogleReview, GoogleReviewResult } from '@/lib/googleReviews'

type Props = {
  reviews: GoogleReview[]
  aggregate: GoogleReviewResult['aggregate']
  themed: boolean
}

const GAP = 12 // gap-3
const MOBILE_BREAKPOINT = 640 // correspond au "sm" de Tailwind
const INTERVAL_MS = 7000

/** Avis clients : défilement automatique, sans flèches. Une carte à la fois
 *  sur mobile (2 côte à côte sur cet écran ne tenaient pas — la 2e était
 *  coupée), 2 par 2 à partir de l'écran "sm". La largeur de carte et le pas
 *  de défilement sont mesurés en direct dans le DOM (pas une valeur fixe) :
 *  ils suivent la largeur réelle définie en CSS, y compris entre les
 *  breakpoints. La position de page est recalculée depuis le scrollLeft réel
 *  à chaque tick, donc un glissement manuel entre deux tick n'est jamais
 *  écrasé par un saut arrière vers une position programmée obsolète. */
export default function ReviewsCarousel({ reviews, aggregate, themed }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollerRef.current
    if (!el || reviews.length <= 1) return

    const id = setInterval(() => {
      const firstCard = el.firstElementChild as HTMLElement | null
      if (!firstCard) return
      const cardWidth = firstCard.getBoundingClientRect().width
      const pageSize = window.innerWidth < MOBILE_BREAKPOINT ? 1 : 2
      const pageStep = (cardWidth + GAP) * pageSize
      const totalPages = Math.ceil(reviews.length / pageSize)

      const currentPage = Math.round(el.scrollLeft / pageStep)
      const nextPage = (currentPage + 1) % totalPages
      el.scrollTo({ left: nextPage * pageStep, behavior: 'smooth' })
    }, INTERVAL_MS)

    return () => clearInterval(id)
  }, [reviews.length])

  return (
    <div className={`rounded-2xl overflow-hidden ${
      themed
        ? 'bg-white/10 backdrop-blur-sm border border-white/15'
        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm'
    }`}>
      <div className="px-5 pt-4 pb-3 flex items-center justify-between">
        <p className={`text-sm font-semibold ${themed ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>
          Avis clients
        </p>
        {aggregate && (
          <div className="flex items-center gap-1.5">
            <span className="text-amber-400 text-sm">★</span>
            <span className={`text-sm font-bold ${themed ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>
              {aggregate.value.toFixed(1)}
            </span>
            {aggregate.count > 0 && (
              <span className={`text-xs ${themed ? 'text-white/50' : 'text-slate-400 dark:text-slate-500'}`}>
                · {aggregate.count} avis
              </span>
            )}
          </div>
        )}
      </div>

      <div
        ref={scrollerRef}
        className="flex gap-3 overflow-x-auto px-5 pb-4 scrollbar-none scroll-smooth snap-x snap-mandatory"
      >
        {reviews.map((rv, i) => (
          <div
            key={i}
            className={`shrink-0 w-[calc(100%-2.5rem)] sm:w-56 rounded-xl p-3.5 snap-start ${
              themed
                ? 'bg-white/10 border border-white/15'
                : 'bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700'
            }`}
          >
            <div className="flex gap-0.5 mb-2">
              {Array.from({ length: 5 }).map((_, s) => (
                <span key={s} className={s < rv.rating ? 'text-amber-400' : (themed ? 'text-white/20' : 'text-slate-200 dark:text-slate-600')}>★</span>
              ))}
            </div>
            <p className={`text-xs leading-relaxed line-clamp-4 mb-2 ${themed ? 'text-white/80' : 'text-slate-600 dark:text-slate-300'}`}>
              &ldquo;{rv.text}&rdquo;
            </p>
            <p className={`text-[11px] font-semibold ${themed ? 'text-white/50' : 'text-slate-400 dark:text-slate-500'}`}>
              — {rv.author}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

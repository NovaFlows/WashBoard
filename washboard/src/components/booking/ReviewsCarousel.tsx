'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import type { GoogleReview, GoogleReviewResult } from '@/lib/googleReviews'

type Props = {
  reviews: GoogleReview[]
  aggregate: GoogleReviewResult['aggregate']
  themed: boolean
}

const CARD_WIDTH = 224 // w-56 (14rem) — largeur d'une carte pour le calcul de défilement
const GAP = 12 // gap-3

/** Avis clients avec défilement horizontal : flèches + molette/glisser, plus
 *  l'indice de défilement (points) qui manquait — sans ça, rien n'indiquait
 *  qu'il y avait d'autres avis à voir après les premiers visibles. */
export default function ReviewsCarousel({ reviews, aggregate, themed }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }, [])

  useEffect(() => {
    updateArrows()
    const el = scrollerRef.current
    if (!el) return
    el.addEventListener('scroll', updateArrows, { passive: true })
    window.addEventListener('resize', updateArrows)
    return () => {
      el.removeEventListener('scroll', updateArrows)
      window.removeEventListener('resize', updateArrows)
    }
  }, [updateArrows])

  function scrollBy(direction: 1 | -1) {
    scrollerRef.current?.scrollBy({ left: direction * (CARD_WIDTH + GAP) * 2, behavior: 'smooth' })
  }

  const arrowBtnClass = `absolute top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full flex items-center justify-center shadow-md text-lg leading-none ${
    themed ? 'bg-white text-slate-700' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200'
  }`
  // Voile derrière chaque flèche : sans lui, le bouton se pose à cru sur le
  // texte de la carte du dessous et se lit comme un chevauchement, pas comme
  // un contrôle de carrousel. Sur fond photo (themed), on ne connaît pas la
  // couleur exacte sous le voile → un fondu neutre (noir/blanc) plutôt qu'une
  // couleur en dur qui jurerait avec la photo.
  const fadeSide = themed ? 'from-black/25' : 'from-white dark:from-slate-900'

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

      <div className="relative">
        {canScrollLeft && (
          <>
            <div className={`absolute inset-y-0 left-0 w-14 bg-gradient-to-r ${fadeSide} to-transparent pointer-events-none z-[5]`} />
            <button
              onClick={() => scrollBy(-1)}
              aria-label="Avis précédents"
              className={`${arrowBtnClass} left-3`}
            >
              ‹
            </button>
          </>
        )}
        {canScrollRight && (
          <>
            <div className={`absolute inset-y-0 right-0 w-14 bg-gradient-to-l ${fadeSide} to-transparent pointer-events-none z-[5]`} />
            <button
              onClick={() => scrollBy(1)}
              aria-label="Avis suivants"
              className={`${arrowBtnClass} right-3`}
            >
              ›
            </button>
          </>
        )}

        <div
          ref={scrollerRef}
          className="flex gap-3 overflow-x-auto px-5 pb-4 scrollbar-none scroll-smooth snap-x snap-mandatory"
        >
          {reviews.map((rv, i) => (
            <div
              key={i}
              className={`shrink-0 w-56 rounded-xl p-3.5 snap-start ${
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
    </div>
  )
}

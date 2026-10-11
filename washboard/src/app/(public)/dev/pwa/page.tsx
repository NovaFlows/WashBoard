'use client'

import { useEffect } from 'react'
import { notFound, useRouter } from 'next/navigation'

/** Bascule locale en display-mode standalone, sans DevTools : patche
 *  `matchMedia` puis renvoie vers le tableau de bord — en navigation
 *  SPA (`router.replace`), jamais `window.location`, sinon le
 *  rechargement complet qu'elle déclenche efface le patch avant même
 *  que la page suivante ne le lise. Le patch tient tant que l'onglet
 *  reste ouvert ; un rechargement complet l'efface. */
export default function DevPwa() {
  if (process.env.NODE_ENV !== 'development') notFound()
  const router = useRouter()

  useEffect(() => {
    const vraie = window.matchMedia.bind(window)
    window.matchMedia = (q: string): MediaQueryList =>
      q.includes('display-mode: standalone')
        ? ({
            matches: true, media: q,
            addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
          } as unknown as MediaQueryList)
        : vraie(q)
    router.replace('/dashboard')
  }, [router])

  return null
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { AppLaveur } from './AppLaveur'
import { useDemo } from './etat'
import type { EcranDemo } from './types'
import './demo.css'

const LARGEUR_ECRAN = 1100
const HAUTEUR_ECRAN = 690

/**
 * Tableau de bord version ordinateur. Dessiné en 1100 × 690 puis réduit pour tenir dans son
 * conteneur : la mise à l'échelle se mesure (la hauteur de layout ne suit pas le `transform`).
 * Dans la scène du héros (`.scene`), on laisse 40 px de marge à la scène.
 */
export function Ordinateur({ ecranInitial = 'auj', largeurMax, masque }: { ecranInitial?: EcranDemo; largeurMax?: number; masque?: boolean }) {
  const { epoque } = useDemo()
  const cadre = useRef<HTMLDivElement>(null)
  const [k, setK] = useState<number | null>(null)

  useEffect(() => {
    const el = cadre.current
    if (!el) return
    const scene = el.closest('.scene')
    const mesurer = () => {
      let l = el.clientWidth
      if (largeurMax) l = Math.min(l, largeurMax)
      if (scene) l = Math.min(l, scene.clientWidth - 40)
      if (l > 0) setK(Math.min(1, l / LARGEUR_ECRAN))
    }
    // Le callback est aussi appelé à l'observation, puis quand l'appareil réapparaît (display: none -> visible).
    const obs = new ResizeObserver(mesurer)
    obs.observe(el)
    if (scene) obs.observe(scene)
    return () => obs.disconnect()
  }, [largeurMax])

  return (
    <div ref={cadre} className="dk-cadre" hidden={masque} data-pret={k !== null ? 'oui' : 'non'} style={k !== null ? { height: HAUTEUR_ECRAN * k } : undefined}>
      <div className="dk" style={{ transform: `scale(${k ?? 1})` }}>
        <div className="dk-barre"><i /><i /><i /><span>washboard.fr/dashboard</span></div>
        <AppLaveur key={epoque} mode="dk" ecranInitial={ecranInitial} />
      </div>
    </div>
  )
}

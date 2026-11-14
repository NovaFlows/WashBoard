'use client'

import { useEffect, useState } from 'react'
import { useT } from '@/components/i18n/I18nProvider'

// Le premier slogan est celui rendu côté serveur : c'est lui que Google et les
// IA lisent comme <h1>, avant toute rotation JS. Il porte les mots-clés métier
// (nettoyage, detailing, auto, à domicile) : ne pas le déplacer. Les suivants
// tournent pour le visiteur ; rester sous ~48 caractères pour tenir en deux
// lignes sur ordinateur.
const SLOGANS: { pre: string; hl: string }[] = [
  { pre: 'Nettoyage, detailing auto.', hl: 'À domicile.' },
  { pre: 'Fais plus.', hl: 'Gère moins.' },
  { pre: 'Tes clients réservent seuls.', hl: 'Toi tu encaisses.' },
  { pre: 'Réservation, planning, factures.', hl: 'Un seul outil.' },
  { pre: 'Ton agenda se remplit.', hl: 'Toi, tu laves.' },
]

export default function TitreRotatif() {
  const t = useT()
  const [i, setI] = useState(0)
  const [sort, setSort] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let relais = 0
    const id = setInterval(() => {
      setSort(true)
      relais = window.setTimeout(() => {
        setI(p => (p + 1) % SLOGANS.length)
        setSort(false)
      }, 360)
    }, 4500)
    return () => { clearInterval(id); clearTimeout(relais) }
  }, [])

  const SLOGANS_T = SLOGANS.map(f => ({ pre: t(f.pre), hl: t(f.hl) }))
  const s = SLOGANS_T[i]
  // Les slogans fantômes, invisibles et empilés dans la même cellule, donnent au
  // bloc la hauteur du plus long à chaque largeur : la page ne bouge plus.
  return (
    <div className="h1-pile">
      {SLOGANS_T.map(f => (
        <div key={f.pre} className="h1 h1-fantome" aria-hidden="true">
          <span className="tl">{f.pre}</span> <span className="tl hl">{f.hl}</span>
        </div>
      ))}
      <h1 className="h1">
        <span className={`tl${sort ? ' sort' : ''}`}>{s.pre}</span>{' '}
        <span className={`tl hl${sort ? ' sort' : ''}`}>{s.hl}</span>
      </h1>
    </div>
  )
}

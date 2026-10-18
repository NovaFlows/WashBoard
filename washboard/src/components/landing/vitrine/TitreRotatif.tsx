'use client'

import { useEffect, useState } from 'react'

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

  const s = SLOGANS[i]
  return (
    <h1 className="h1">
      <span className={`tl${sort ? ' sort' : ''}`}>{s.pre}</span>{' '}
      <span className={`tl hl${sort ? ' sort' : ''}`}>{s.hl}</span>
    </h1>
  )
}

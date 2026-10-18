'use client'

import { useState, type ReactNode } from 'react'
import CarteCreneaux from './CarteCreneaux'

export default function CreneauxDemo({ etapes }: { etapes: ReactNode }) {
  const [avec, setAvec] = useState(false)
  return (
    <div className="cg">
      <CarteCreneaux avec={avec} />
      <div>
        <div className="segment" role="group" aria-label="Comparer">
          <button type="button" aria-pressed={!avec} onClick={() => setAvec(false)}>Sans WashBoard</button>
          <button type="button" aria-pressed={avec} onClick={() => setAvec(true)}>Avec les créneaux groupés</button>
        </div>
        {etapes}
      </div>
    </div>
  )
}

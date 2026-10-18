'use client'

import dynamic from 'next/dynamic'
import { useRef, useState, type ReactNode } from 'react'
import type { CommandesCarte } from '@/components/fidelite/CarteFidelite3D'
import { FINITIONS_CARTE, LIBELLES_FINITION, NUANCES_CARTE, type FinitionCarte } from '@/lib/carteFidelite'

// Sous la ligne de flottaison : chargée à la demande, côté client seulement.
const CarteFidelite3D = dynamic(() => import('@/components/fidelite/CarteFidelite3D'), {
  ssr: false,
  loading: () => <div className="fid-ph" aria-hidden />,
})

const REQUIS = 8

export default function FideliteDemo({ avant, apres }: { avant: ReactNode; apres: ReactNode }) {
  const carte = useRef<CommandesCarte>(null)
  const [couleur, setCouleur] = useState(NUANCES_CARTE[0].hex)
  const [finition, setFinition] = useState<FinitionCarte>('holo')
  const [tampons, setTampons] = useState(5)
  const occupe = useRef(false)

  // Un tampon à la fois : la carte joue son animation (et sa fête au dernier).
  const terminer = () => {
    if (occupe.current) return
    occupe.current = true
    const index = tampons >= REQUIS ? 0 : tampons
    setTampons(index + 1)
    carte.current?.tamponner(index, REQUIS)
    setTimeout(() => { occupe.current = false }, index + 1 >= REQUIS ? 3600 : 1800)
  }

  return (
    <div className="fid">
      <div className="fid-scene">
        <CarteFidelite3D
          ref={carte} couleur={couleur} finition={finition} nom="Éclat Mobile" numero="4F2A"
          requis={REQUIS} tampons={tampons} recompense="Lavage complet offert" scenario="apercu" largeur={440}
        />
      </div>
      <div>
        {avant}
        <div className="fid-cmd">
          <div>
            <p className="cmd-lib">Ta couleur</p>
            <div className="nuances" role="group" aria-label="Couleur de la carte">
              {NUANCES_CARTE.map(n => (
                <button key={n.hex} type="button" className="nuance" style={{ background: n.hex }} aria-label={n.nom} aria-pressed={couleur === n.hex} onClick={() => setCouleur(n.hex)} />
              ))}
            </div>
          </div>
          <div>
            <p className="cmd-lib">La finition</p>
            <div className="segment" role="group" aria-label="Finition">
              {FINITIONS_CARTE.map(f => (
                <button key={f} type="button" aria-pressed={finition === f} onClick={() => setFinition(f)}>{LIBELLES_FINITION[f]}</button>
              ))}
            </div>
          </div>
          <div className="fid-actions">
            <button type="button" className="btn btn-encre" onClick={terminer}>Terminer une prestation</button>
            <button type="button" className="btn btn-ligne" onClick={() => carte.current?.retourner()}>Retourner la carte</button>
          </div>
        </div>
        {apres}
      </div>
    </div>
  )
}

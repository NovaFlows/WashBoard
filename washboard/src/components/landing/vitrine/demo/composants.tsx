'use client'

import { useSyncExternalStore, type CSSProperties } from 'react'
import { variablesCarte } from '@/lib/carteFidelite'
import '@/components/fidelite/carteFidelite3D.css'
import '../base.css'
import './demo.css'

// ── Compte à rebours des promotions (fictif : fin dimanche 23 h 59) ──

let fin = 0
const abonnes = new Set<() => void>()
let minuteur: ReturnType<typeof setInterval> | null = null

function abonner(cb: () => void) {
  abonnes.add(cb)
  if (!minuteur) minuteur = setInterval(() => abonnes.forEach(f => f()), 1000)
  return () => {
    abonnes.delete(cb)
    if (!abonnes.size && minuteur) { clearInterval(minuteur); minuteur = null }
  }
}

function instantane() {
  // Fixé au premier affichage : le rebours part de 1 j 10:12:40 puis s'écoule.
  if (!fin) fin = Date.now() + ((34 * 60 + 12) * 60 + 40) * 1000
  const r = Math.max(0, fin - Date.now())
  const j = Math.floor(r / 864e5), h = Math.floor((r % 864e5) / 36e5), m = Math.floor((r % 36e5) / 6e4), s = Math.floor((r % 6e4) / 1e3)
  return `${j} j ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function CompteARebours() {
  const t = useSyncExternalStore(abonner, instantane, () => '')
  return <span className="cd">{t}</span>
}

// ── Carte de fidélité figée (fiche client, réglages) ──

/** Le recto de la carte, sans 3D : mêmes classes `wb-cf-*` que le vrai composant. */
export function CarteStatique({ tampons, requis, saute, couleur, recompense }: { tampons: number; requis: number; saute?: boolean; couleur: string; recompense: string }) {
  const style = variablesCarte(couleur) as CSSProperties
  return (
    <div className="wb-cf wb-cf-statique" style={style}>
      <div className="wb-cf-entree" role="img" aria-label={`Carte de fidélité, ${tampons} tampons sur ${requis}`}>
        <div className="wb-cf-carte" data-finition="brillante">
          <div className="wb-cf-face">
            <div className="wb-cf-fond" /><div className="wb-cf-lignes" /><div className="wb-cf-grain" />
            <div className="wb-cf-patch" aria-hidden>
              <svg viewBox="0 0 24 24"><path d="M12 2.5c4.3 5.4 6.6 9.1 6.6 12.3a6.6 6.6 0 0 1-13.2 0c0-3.2 2.3-6.9 6.6-12.3z" fill="#fff" /></svg>
            </div>
            <div className="wb-cf-recto-contenu">
              <div className="wb-cf-haut">
                <div className="wb-cf-logo" aria-hidden>É</div>
                <div className="wb-cf-ident">
                  <div className="wb-cf-nom">Éclat Mobile</div>
                  <div className="wb-cf-sous">Carte de fidélité</div>
                </div>
                <div className="wb-cf-numero">N° 4F2A</div>
              </div>
              <div className="wb-cf-bas">
                <div style={{ minWidth: 0 }}>
                  <span className="wb-cf-lbl">Récompense</span>
                  <span className="wb-cf-val">{recompense}</span>
                </div>
                <div className="wb-cf-compte">
                  <span className="wb-cf-lbl">Tampons</span>
                  {/* key : l'animation rejoue quand le tampon arrive */}
                  <span key={tampons} className={`wb-cf-val wb-cf-gros${saute ? ' wb-cf-saute' : ''}`}>{tampons}/{requis}</span>
                </div>
              </div>
            </div>
            <div className="wb-cf-reflet" /><div className="wb-cf-arete" />
          </div>
        </div>
      </div>
    </div>
  )
}

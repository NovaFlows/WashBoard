'use client'

// Contrat de la démo manipulable de la landing (refonte 2026). Les sections de
// la page n'importent QUE ce fichier. Une seule journée fictive, un seul état
// partagé : le téléphone du héros, la démo téléphone/ordinateur et la page de
// réservation client lisent et modifient le même état.

import { useState } from 'react'
import { AppLaveur } from './AppLaveur'
import { MISSIONS } from './donnees'
import { useDemo } from './etat'
import { I } from './icones'
import { Ordinateur } from './Ordinateur'
import { PleinEcranTel } from './PleinEcran'
import type { EcranDemo } from './types'
import '../base.css'
import './demo.css'
import { useT } from '@/components/i18n/I18nProvider'

export type { EcranDemo }
export { DemoProvider } from './etat'
export { ReservationClient } from './Reservation'

/** Téléphone du laveur, cadre compris (classe `.tel`), manipulable, ouvrable en plein écran sur mobile. */
export function AppTelephone({ ecranInitial = 'auj', masque }: { ecranInitial?: EcranDemo; masque?: boolean }) {
  const { epoque } = useDemo()
  return (
    <PleinEcranTel masque={masque}>
      <div className="tel">
        <AppLaveur key={epoque} mode="tel" ecranInitial={ecranInitial} />
      </div>
    </PleinEcranTel>
  )
}

/** Version ordinateur du tableau de bord, cadre de fenêtre compris, mise à l'échelle de son conteneur. */
export function AppOrdinateur({ ecranInitial = 'auj', largeurMax }: { ecranInitial?: EcranDemo; largeurMax?: number }) {
  return <Ordinateur ecranInitial={ecranInitial} largeurMax={largeurMax} />
}

/** Contenu de la section « Démo manipulable » sous son titre : sélecteur d'appareil, missions, appareil. */
export function DemoManipulable() {
  const tr = useT()
  const { etat, raz } = useDemo()
  const [ordi, setOrdi] = useState(false)
  const faites = Object.values(etat.m).filter(Boolean).length

  return (
    <div className="demo-grille">
      <div>
        <div className="segment" role="group" aria-label={tr('Appareil')}>
          <button aria-pressed={!ordi} onClick={() => setOrdi(false)}>{I.mobile}{tr('Téléphone')}</button>
          <button aria-pressed={ordi} onClick={() => setOrdi(true)}>{I.ordi}{tr('Ordinateur')}</button>
        </div>
        <div className="missions">
          {MISSIONS.map(([k, t, s], i) => (
            <div key={k} className={`mission${etat.m[k] ? ' faite' : ''}`}>
              <span className="coche">{I.ok}<span>{i + 1}</span></span>
              <div><b>{tr(t)}{etat.m[k] ? <span className="vh"> {tr('(faite)')}</span> : null}</b><small>{tr(s)}</small></div>
            </div>
          ))}
        </div>
        <div className="demo-pied">
          <span aria-live="polite">{faites === 4 ? 'Tout est fait. Tout s’est mis à jour tout seul.' : `${faites} sur 4`}</span>
          <button onClick={raz}>{tr('Remettre la journée à zéro')}</button>
        </div>
      </div>
      <div className="demo-scene aura">
        <AppTelephone masque={ordi} />
        <Ordinateur masque={!ordi} />
      </div>
    </div>
  )
}

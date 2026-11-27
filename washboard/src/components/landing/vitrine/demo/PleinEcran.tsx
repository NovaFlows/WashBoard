'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { I } from './icones'
import { useT } from '@/components/i18n/I18nProvider'

const CLE_HISTORIQUE = 'demoPleinEcran'

/**
 * Téléphone de démo ouvrable en plein écran sur mobile (bouton masqué au-delà de 760 px).
 * Le même élément passe en position fixe : l'état de la démo est conservé à l'ouverture comme à la sortie.
 * Une entrée d'historique est ajoutée pour que le bouton retour du téléphone referme la démo.
 */
export function PleinEcranTel({ children, masque }: { children: ReactNode; masque?: boolean }) {
  const t = useT()
  const [ouvert, setOuvert] = useState(false)
  const cadre = useRef<HTMLDivElement>(null)
  const boutonOuvrir = useRef<HTMLButtonElement>(null)
  const boutonQuitter = useRef<HTMLButtonElement>(null)

  const ouvrir = () => {
    window.history.pushState({ [CLE_HISTORIQUE]: true }, '')
    setOuvert(true)
  }

  const fermer = useCallback(() => {
    if (window.history.state?.[CLE_HISTORIQUE]) window.history.back()
    else setOuvert(false)
  }, [])

  useEffect(() => {
    if (!ouvert) return
    const racine = document.documentElement
    const avant = racine.style.overflow
    racine.style.overflow = 'hidden'
    boutonQuitter.current?.focus({ preventScroll: true })
    const surRetour = () => setOuvert(false)
    // Capture : passe avant le gestionnaire de la démo, qui fermerait la feuille avant qu'on la voie ouverte.
    const surTouche = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      const voile = cadre.current?.querySelector<HTMLElement>('.voile.ouvert')
      if (voile) voile.click()
      else fermer()
    }
    window.addEventListener('popstate', surRetour)
    document.addEventListener('keydown', surTouche, true)
    const bouton = boutonOuvrir.current
    return () => {
      racine.style.overflow = avant
      window.removeEventListener('popstate', surRetour)
      document.removeEventListener('keydown', surTouche, true)
      bouton?.focus({ preventScroll: true })
    }
  }, [ouvert, fermer])

  return (
    <div className={`tel-pe${ouvert ? ' ouvert' : ''}`} hidden={masque}>
      <div
        className="tel-pe-cadre"
        ref={cadre}
        role={ouvert ? 'dialog' : undefined}
        aria-modal={ouvert || undefined}
        aria-label={ouvert ? t('Démo WashBoard en plein écran') : undefined}
      >
        {ouvert ? (
          <div className="tel-pe-barre">
            <span>{t('Démo · données fictives')}</span>
            <button type="button" ref={boutonQuitter} className="tel-pe-quitter" onClick={fermer}>{I.fermer}{t('Quitter')}</button>
          </div>
        ) : null}
        {children}
      </div>
      {/* Toujours rendu (masqué une fois ouvert) : il récupère le focus à la fermeture. */}
      <button type="button" ref={boutonOuvrir} className="tel-pe-ouvrir" onClick={ouvrir} hidden={ouvert}>
        <span className="tel-pe-pastille">{I.agrandir}{t('Essayer en plein écran')}</span>
      </button>
    </div>
  )
}

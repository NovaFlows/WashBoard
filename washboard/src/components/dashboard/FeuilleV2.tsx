'use client'

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useBloquerDefilement, useGlisserPourFermer } from '@/hooks/useFeuilleTactile'

// Feuille du bas générique de l'agenda v2 — réservée à la PWA installée en
// mode standalone (voir CalendrierDashboardV2.tsx et `.claude/agents/refonte.md`,
// « v1 sur le site, v2 seulement dans la PWA installée »). Passe 7, sous-lot 3 :
// elle porte le menu « + », le formulaire de rendez-vous manuel et les deux
// feuilles de congés (poser, supprimer).
//
// Même mécanique que `DetailRendezVous` (CalendrierDashboardV2.tsx) : feuille
// qui monte du bas sur l'ease-sheet en 320 ms, Échap, piège de focus, retour du
// focus à l'élément d'origine, masque le bouton WhatsApp flottant. Recopiée
// ici plutôt que tirée de `DetailRendezVous` : ce composant-là est livré et
// commité, y toucher pour en extraire une base commune aurait mélangé une
// refactorisation à un sous-lot de fonctionnalité — à faire plus tard si une
// quatrième feuille apparaît.
//
// Le focus initial va au bouton Fermer, jamais à un champ : sur mobile,
// focaliser un champ ouvre le clavier avant même que la feuille soit lisible.
//
// `fermerSurFond` : un formulaire long ne se ferme PAS d'un tap à côté (les
// mains mouillées ratent souvent la cible, et tout ce qui a été saisi serait
// perdu). Fermeture explicite : la croix, « Annuler », ou Échap.

export const police = '[font-family:var(--font-archivo)]'
export const corps = `${police} [font-weight:var(--v2-type-corps-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
export const corpsFort = `${police} [font-weight:var(--v2-type-corps-fort-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
export const titre = `${police} [font-weight:var(--v2-type-titre-poids)] [font-stretch:var(--v2-type-titre-largeur)] tracking-[var(--v2-type-titre-tracking)]`

/** Champ de saisie : 44 px de haut, 16 px de police (sinon iOS zoome). */
export const CHAMP = `w-full min-w-0 h-11 px-3 rounded-[var(--v2-radius-bouton)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] text-[16px] ${corps} text-[color:var(--v2-color-encre)] placeholder:text-[color:var(--v2-color-gris)] focus:outline-none focus:ring-2 focus:ring-[color:var(--v2-color-accent)]/40`

export const ETIQUETTE = `mb-1.5 block text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`

/** Base commune des boutons pleine largeur : 44 px, pression 120 ms scale(.97). */
export const BOUTON = `flex h-11 items-center justify-center rounded-[var(--v2-radius-bouton)] px-4 text-[15px] ${corpsFort} transition-transform active:scale-[.97] disabled:opacity-50 disabled:active:scale-100`

export const PRESSION: CSSProperties = {
  transitionDuration: 'var(--v2-duration-press)',
  transitionTimingFunction: 'var(--v2-ease-out)',
}

const SELECTEUR_FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function Feuille({
  titre: intitule,
  sousTitre,
  onClose,
  children,
  pied,
  fermerSurFond = true,
}: {
  titre: string
  sousTitre?: string
  onClose: () => void
  children: ReactNode
  /** Zone d'actions fixée en bas de la feuille (le corps défile au-dessus). */
  pied?: ReactNode
  fermerSurFond?: boolean
}) {
  const [visible, setVisible] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const feuilleRef = useRef<HTMLDivElement>(null)
  useBloquerDefilement()
  const glisser = useGlisserPourFermer(onClose)
  const focusPrecedent = useRef<HTMLElement | null>(null)
  const idTitre = useId()

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    focusPrecedent.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    return () => { if (focusPrecedent.current?.isConnected) focusPrecedent.current.focus() }
  }, [])

  useEffect(() => {
    document.body.classList.add('wb-hide-fab')
    return () => document.body.classList.remove('wb-hide-fab')
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab' || !feuilleRef.current) return
      const items = feuilleRef.current.querySelectorAll<HTMLElement>(SELECTEUR_FOCUSABLE)
      if (items.length === 0) return
      const premier = items[0]
      const dernier = items[items.length - 1]
      if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus() }
      else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby={idTitre}>
      <button
        aria-hidden
        tabIndex={-1}
        onClick={fermerSurFond ? onClose : undefined}
        className={`absolute inset-0 touch-none bg-[color:var(--v2-color-encre)]/40 backdrop-blur-[2px] transition-opacity motion-reduce:transition-none ${visible ? 'opacity-100' : 'opacity-0'}`}
        style={{ transitionDuration: 'var(--v2-duration-sheet)', transitionTimingFunction: 'var(--v2-ease-sheet)', cursor: 'default' }}
      />
      <div
        ref={feuilleRef}
        className={`relative flex w-full max-h-[92dvh] flex-col overflow-hidden bg-[color:var(--v2-color-surface)] text-[color:var(--v2-color-encre)] ${police} rounded-t-[var(--v2-radius-feuille)] transition-transform motion-reduce:transition-none sm:max-w-md sm:rounded-[var(--v2-radius-surface)] sm:transition-[transform,opacity] ${
          visible ? 'translate-y-0 sm:scale-100 sm:opacity-100' : 'translate-y-full sm:translate-y-0 sm:scale-95 sm:opacity-0'
        }`}
        style={{ transitionDuration: 'var(--v2-duration-sheet)', transitionTimingFunction: 'var(--v2-ease-sheet)', ...glisser.styleFeuille }}
      >
        <div className="flex cursor-grab justify-center pt-2.5 pb-3 sm:hidden" aria-hidden {...glisser.poignee}>
          <span className="h-1 w-9 rounded-full bg-[color:var(--v2-filet-fort)]" />
        </div>

        <div className="flex items-start gap-3 px-5 pt-1 sm:pt-5">
          <div className="min-w-0 flex-1 pt-2">
            <h2 id={idTitre} className={`text-[21px] ${titre}`}>{intitule}</h2>
            {sousTitre && (
              <p className={`mt-1 text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>{sousTitre}</p>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[color:var(--v2-color-gris)] transition-colors hover:bg-[color:var(--v2-filet)] hover:text-[color:var(--v2-color-encre)]"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        <div
          className="flex-1 overflow-y-auto overscroll-contain px-5 pt-4"
          style={{ paddingBottom: pied ? 16 : 'calc(env(safe-area-inset-bottom) + 20px)' }}
        >
          {children}
        </div>

        {pied && (
          <div
            className="border-t border-[color:var(--v2-filet)] px-5 pt-3"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
          >
            {pied}
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { Lock, X } from 'lucide-react'
import { requiredPlanLabel, type Feature } from '@/lib/plan'
import { useOffre } from '@/components/dashboard/OffreContext'
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
//
// Un tap sur le fond ferme la feuille, comme un glissement de la poignée vers le bas —
// pour TOUTES les feuilles (demandé par Alexandre, 2026-09-29), formulaires compris.

export const police = '[font-family:var(--font-archivo)]'
export const corps = `${police} [font-weight:var(--v2-type-corps-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
export const corpsFort = `${police} [font-weight:var(--v2-type-corps-fort-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
export const titre = `${police} [font-weight:var(--v2-type-titre-poids)] [font-stretch:var(--v2-type-titre-largeur)] tracking-[var(--v2-type-titre-tracking)]`

/** Champ de saisie : 44 px de haut, 16 px de police (sinon iOS zoome). */
export const CHAMP = `w-full min-w-0 h-11 px-3 rounded-[var(--v2-radius-bouton)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] text-[16px] ${corps} text-[color:var(--v2-color-encre)] placeholder:text-[color:var(--v2-color-gris)] focus:outline-none focus:ring-2 focus:ring-[color:var(--v2-color-accent)]/40`

export const ETIQUETTE = `mb-1.5 block text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`

/** Base commune des boutons pleine largeur : 44 px, pression 120 ms scale(.97). */
export const BOUTON = `flex h-11 items-center justify-center rounded-[var(--v2-radius-bouton)] px-4 text-[15px] ${corpsFort} transition-transform active:scale-[.97] disabled:opacity-50 disabled:active:scale-100`

/** Puce de choix : encre pleine quand elle est choisie, contour sinon. 44 px de
 *  haut. Même style que les puces de `ReglageAutomatismeV2` (qui garde la sienne,
 *  livrée avant celle-ci). */
export const puce = (actif: boolean) =>
  `shrink-0 h-11 px-4 rounded-[var(--v2-radius-pilule)] text-[13.5px] ${corpsFort} border transition-colors motion-reduce:transition-none ${
    actif
      ? 'bg-[color:var(--v2-color-encre)] text-[color:var(--v2-color-surface)] border-[color:var(--v2-color-encre)]'
      : 'bg-transparent text-[color:var(--v2-color-gris)] border-[color:var(--v2-filet-fort)]'
  }`

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
  verrou,
  panneau = false,
}: {
  titre: ReactNode
  sousTitre?: string
  onClose: () => void
  children: ReactNode
  /** Zone d'actions fixée en bas de la feuille (le corps défile au-dessus). */
  pied?: ReactNode
  /** Fonctionnalité d'offre dont dépend cette feuille. Si l'offre en cours ne
   *  la couvre pas, le contenu reste VISIBLE mais flou et inerte (on voit ce
   *  qu'on obtient, sans pouvoir le remplir pour rien), une pastille dit quelle
   *  offre l'ouvre, et le pied est remplacé par la porte vers les offres. Le
   *  serveur refuse de toute façon (403) : ceci évite seulement de faire
   *  travailler quelqu'un avant de lui dire non. */
  verrou?: Feature
  /** Passe bureau (2026-10-07, Apparence de ma page — `ApparenceV2.tsx`, `useApparenceCoteACote`) :
   *  posée à la place de la liste de réglages, dans la colonne de gauche, plutôt qu'en fenêtre
   *  qui recouvre l'écran (et l'aperçu à droite). Même raisonnement que `panneau` sur
   *  `ClientProfileModalV2` (à regarder avant d'inventer autre chose) : pas de fond assombri, pas
   *  de centrage, pas de blocage du défilement de la PAGE (elle n'est plus recouverte), pas de
   *  vol de focus ni de piège de tabulation (l'aperçu et le reste de l'écran doivent rester
   *  atteignables à la tabulation), pas d'animation d'entrée. Seule différence avec ce
   *  précédent : Échap et le bouton Fermer continuent de fonctionner ICI aussi — Alexandre,
   *  2026-10-07 : « la touche Échap et la fermeture doivent continuer de marcher quelle que soit
   *  la forme du réglage » — donc un seul comportement pour les deux formes, pas désactivé en
   *  panneau comme sur la fiche client. */
  panneau?: boolean
}) {
  const { peut } = useOffre()
  const ferme = !!verrou && !peut(verrou)
  const [visible, setVisible] = useState(panneau)
  const closeRef = useRef<HTMLButtonElement>(null)
  const feuilleRef = useRef<HTMLDivElement>(null)
  useBloquerDefilement(!panneau)
  const glisser = useGlisserPourFermer(onClose)
  const focusPrecedent = useRef<HTMLElement | null>(null)
  const idTitre = useId()

  useEffect(() => {
    if (panneau) return
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [panneau])

  useEffect(() => {
    if (panneau) return
    focusPrecedent.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    return () => { if (focusPrecedent.current?.isConnected) focusPrecedent.current.focus() }
  }, [panneau])

  useEffect(() => {
    if (panneau) return
    document.body.classList.add('wb-hide-fab')
    return () => document.body.classList.remove('wb-hide-fab')
  }, [panneau])

  // Échap ferme la feuille quelle que soit sa forme (panneau compris, voir plus haut) : seul
  // le piège de tabulation ne s'applique qu'à la fenêtre qui recouvre l'écran.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (panneau || e.key !== 'Tab' || !feuilleRef.current) return
      const items = feuilleRef.current.querySelectorAll<HTMLElement>(SELECTEUR_FOCUSABLE)
      if (items.length === 0) return
      const premier = items[0]
      const dernier = items[items.length - 1]
      if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus() }
      else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, panneau])

  return (
    <div
      className={panneau ? 'relative flex w-full flex-col' : 'fixed inset-0 z-50 flex items-end justify-center sm:items-center'}
      role={panneau ? 'region' : 'dialog'}
      aria-modal={panneau ? undefined : true}
      aria-labelledby={idTitre}
    >
      {!panneau && (
        <button
          aria-hidden
          tabIndex={-1}
          onClick={onClose}
          className={`absolute inset-0 touch-none bg-[color:var(--v2-color-encre)]/40 backdrop-blur-[2px] transition-opacity motion-reduce:transition-none ${visible ? 'opacity-100' : 'opacity-0'}`}
          style={{ transitionDuration: 'var(--v2-duration-sheet)', transitionTimingFunction: 'var(--v2-ease-sheet)', cursor: 'default' }}
        />
      )}
      <div
        ref={feuilleRef}
        className={panneau
          ? `relative flex w-full flex-col overflow-hidden rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] text-[color:var(--v2-color-encre)] ${police}`
          : `relative flex w-full max-h-[92dvh] flex-col overflow-hidden bg-[color:var(--v2-color-surface)] text-[color:var(--v2-color-encre)] ${police} rounded-t-[var(--v2-radius-feuille)] transition-transform motion-reduce:transition-none sm:max-w-md sm:rounded-[var(--v2-radius-surface)] sm:transition-[transform,opacity] ${
              visible ? 'translate-y-0 sm:scale-100 sm:opacity-100' : 'translate-y-full sm:translate-y-0 sm:scale-95 sm:opacity-0'
            }`}
        // `pan-y` : dans une feuille, le doigt ne fait que défiler vers le haut ou le bas.
        // Ni pincement pour zoomer, ni glissement latéral — une fiche zoomée puis décalée sur
        // le côté est désagréable et donne l'impression que l'application est cassée (signalé
        // par Alexandre, 2026-09-26). Le reste de l'application garde le zoom : on ne prive
        // personne d'agrandir son planning. Absent en panneau : rien à tirer, pas de doigt.
        style={panneau ? undefined : { touchAction: 'pan-y', transitionDuration: 'var(--v2-duration-sheet)', transitionTimingFunction: 'var(--v2-ease-sheet)', ...glisser.styleFeuille }}
      >
        {/* Bande du haut (poignée + titre) : zone de tirage pour fermer la feuille — absente
            du panneau bureau, qui ne se ferme pas d'un geste. */}
        <div className="shrink-0" {...(panneau ? {} : glisser.poignee)}>
        {!panneau && (
          <div className="flex justify-center pt-2.5 pb-3 sm:hidden" aria-hidden>
            <span className="h-1 w-9 rounded-full bg-[color:var(--v2-filet-fort)]" />
          </div>
        )}

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
        </div>

        <div
          // `overflow-x-hidden` : sans lui, un seul champ trop large (un `select` au contenu
          // long sur iPhone) rendrait toute la feuille déplaçable latéralement. Absent en
          // panneau : pas de défilement interne propre, la colonne (donc la page) défile —
          // il n'y a ni geste tactile ni hauteur figée à faire tenir dans cette forme-là.
          className={panneau
            ? 'px-5 pt-4 [&_input]:max-w-full [&_select]:max-w-full [&_textarea]:max-w-full'
            : 'flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-5 pt-4 [&_input]:max-w-full [&_select]:max-w-full [&_textarea]:max-w-full'}
          style={{ paddingBottom: pied || ferme ? 16 : panneau ? 20 : 'calc(env(safe-area-inset-bottom) + 20px)' }}
        >
          {ferme && verrou ? (
            <div className="relative">
              <div inert className="select-none [&_input]:blur-[4px] [&_textarea]:blur-[4px] [&_select]:blur-[4px] [&_button]:blur-[4px] [&_img]:blur-[4px] [&_p]:blur-[3px] [&_svg]:opacity-40">
                {children}
              </div>
              <div className="absolute inset-0 flex items-start justify-center pt-10">
                <Link
                  href="/dashboard/abonnement"
                  className={`inline-flex items-center gap-2 rounded-full border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] px-4 py-2.5 text-[13.5px] shadow-lg ${corpsFort}`}
                >
                  <Lock size={14} strokeWidth={2.4} aria-hidden />
                  Inclus dans l’offre {requiredPlanLabel(verrou)}
                </Link>
              </div>
            </div>
          ) : children}
        </div>

        {(pied || ferme) && (
          <div
            className="border-t border-[color:var(--v2-filet)] px-5 pt-3"
            style={{ paddingBottom: panneau ? 16 : 'calc(env(safe-area-inset-bottom) + 16px)' }}
          >
            {ferme ? (
              <Link
                href="/dashboard/abonnement"
                className={`${BOUTON} w-full text-[color:var(--v2-color-sur-accent)]`}
                style={{ background: 'var(--v2-color-accent)', ...PRESSION }}
              >
                Voir les offres
              </Link>
            ) : pied}
          </div>
        )}
      </div>
    </div>
  )
}

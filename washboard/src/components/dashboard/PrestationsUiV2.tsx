'use client'

import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Feuille, BOUTON, PRESSION, corps, corpsFort, police } from '@/components/dashboard/FeuilleV2'

// Petites pièces partagées par les écrans « Prestations et prix » et « Horaires »
// de la PWA (`PrestationsV2` et ses feuilles, `HorairesV2` et ses feuilles).

export const nom = `${police} [font-weight:var(--v2-type-nom-poids)] [font-stretch:var(--v2-type-nom-largeur)]`

/** Rouge pour un texte ou un lien (« Supprimer… »). Le rouge du jeton, seul, tombe
 *  à environ 2,5:1 sur la surface sombre — trop peu pour du texte : on le mêle à
 *  l'encre, ce qui garde la teinte et donne ~4,6:1 en sombre (et un rouge plus
 *  profond, lisible, en clair). Réservé au TEXTE ; les points restent le rouge pur. */
export const TEXTE_ROUGE = 'color-mix(in srgb, var(--v2-color-rouge) 70%, var(--v2-color-encre))'

/** Un constat : point plein de la couleur du statut + une phrase en encre. Le
 *  point porte la couleur, le texte reste lisible dans les deux thèmes (le rouge
 *  et l'ambre seuls, sur fond sombre, ne donnent pas un contraste de texte). */
export function Constat({
  ton, children, role,
}: { ton: 'rouge' | 'ambre'; children: ReactNode; role?: 'alert' | 'status' }) {
  return (
    <p role={role} className="flex items-start gap-2">
      <span
        className="mt-[7px] h-[7px] w-[7px] shrink-0 rounded-full"
        style={{ background: ton === 'rouge' ? 'var(--v2-color-rouge)' : 'var(--v2-color-ambre)' }}
        aria-hidden
      />
      <span className={`min-w-0 text-[13.5px] leading-snug ${corps} text-[color:var(--v2-color-encre)]`}>{children}</span>
    </p>
  )
}

/** Confirmation d'une suppression, en feuille du bas : Annuler / action rouge,
 *  l'échec éventuel dit sur place. Déplacée ici depuis `PrestationsV2` pour que
 *  l'écran Horaires la partage sans charger tout l'écran Prestations. */
export function ConfirmationSuppression({
  titre: intitule, texte, remarque, enCours, erreur, libelleAction = 'Supprimer', libelleEnCours = 'Suppression…', onConfirmer, onClose,
}: {
  titre: string
  texte: string
  remarque?: string
  enCours: boolean
  erreur: string | null
  /** Texte du bouton rouge (« Supprimer » par défaut, « Retirer » pour une plage). */
  libelleAction?: string
  libelleEnCours?: string
  onConfirmer: () => void
  onClose: () => void
}) {
  return (
    <Feuille
      titre={intitule}
      onClose={onClose}
      pied={
        <div>
          {erreur && <div className="mb-3"><Constat ton="rouge" role="alert">{erreur}</Constat></div>}
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className={`${BOUTON} flex-1 border border-[color:var(--v2-filet-fort)] text-[color:var(--v2-color-encre)]`}
              style={PRESSION}
            >
              {erreur ? 'Fermer' : 'Annuler'}
            </button>
            <button
              type="button"
              onClick={onConfirmer}
              disabled={enCours}
              className={`${BOUTON} flex-1 text-white`}
              style={{ background: 'var(--v2-color-rouge)', ...PRESSION }}
            >
              {enCours ? libelleEnCours : libelleAction}
            </button>
          </div>
        </div>
      }
    >
      <p className={`text-[15px] leading-snug ${corps}`}>{texte}</p>
      {remarque && <p className={`mt-3 text-[13.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>{remarque}</p>}
    </Feuille>
  )
}

/** Section repliée par défaut, avec sa ligne de résumé : le formulaire reste
 *  court, et ce qui est réglé se lit sans l'ouvrir. */
export function Repliable({
  id, titre, resume, ouvert, onBascule, children,
}: { id: string; titre: string; resume: string; ouvert: boolean; onBascule: () => void; children: ReactNode }) {
  return (
    <section className="border-t border-[color:var(--v2-filet)]">
      <h3>
        <button
          type="button"
          aria-expanded={ouvert}
          aria-controls={id}
          onClick={onBascule}
          className="flex min-h-12 w-full items-center gap-3 py-2 text-left"
        >
          <span className={`text-[15px] ${corpsFort}`}>{titre}</span>
          <span className={`ml-auto min-w-0 truncate text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>{resume}</span>
          <ChevronDown
            size={17}
            strokeWidth={2}
            aria-hidden
            className={`shrink-0 text-[color:var(--v2-color-gris)] transition-transform motion-reduce:transition-none ${ouvert ? 'rotate-180' : ''}`}
            style={{ transitionDuration: 'var(--v2-duration-press)', transitionTimingFunction: 'var(--v2-ease-out)' }}
          />
        </button>
      </h3>
      {ouvert && <div id={id} className="pb-5">{children}</div>}
    </section>
  )
}

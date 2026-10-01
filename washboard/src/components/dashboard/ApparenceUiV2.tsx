'use client'

import type { ReactNode } from 'react'
import { corps } from '@/components/dashboard/FeuilleV2'
import { Constat } from '@/components/dashboard/PrestationsUiV2'
import { phraseProgression } from '@/lib/apparence'
import type { EtatImage } from '@/hooks/useApparenceV2'

// Petites pièces partagées par l'écran « Apparence de ma page » de la PWA
// (`ApparenceV2`) et ses feuilles.

/** Où en est un envoi d'image : progression (avec un petit anneau), échec (une
 *  phrase, le texte reste), ou « fait » (si `texteFait` est donné). Rien au repos.
 *  Affiché à la fois sur l'écran et dans la feuille : l'état vit dans le hook, la
 *  fermer n'efface rien. */
export function EtatEnvoi({ etat, texteFait }: { etat: EtatImage; texteFait?: string }): ReactNode {
  const phrase = phraseProgression(etat.phase, etat.attenteLongue)
  if (phrase) {
    return (
      <p role="status" className="flex items-start gap-2.5">
        <span
          aria-hidden
          className="mt-[3px] h-[15px] w-[15px] shrink-0 rounded-full border-2 border-[color:var(--v2-filet-fort)] border-t-[color:var(--v2-color-encre)] motion-safe:animate-spin"
        />
        <span className={`min-w-0 text-[13.5px] leading-snug ${corps} text-[color:var(--v2-color-encre)]`}>{phrase}</span>
      </p>
    )
  }
  if (etat.phase === 'echec' && etat.erreur) return <Constat ton="rouge" role="alert">{etat.erreur}</Constat>
  if (etat.phase === 'fait' && texteFait) {
    return (
      <p role="status" className="flex items-start gap-2">
        <span className="mt-[7px] h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: 'var(--v2-color-vert)' }} aria-hidden />
        <span className={`min-w-0 text-[13.5px] leading-snug ${corps} text-[color:var(--v2-color-encre)]`}>{texteFait}</span>
      </p>
    )
  }
  return null
}

/** Vrai tant qu'un envoi d'image est en cours (détourage ou mise en ligne). */
export const enCoursEnvoi = (etat: EtatImage) => etat.phase === 'detourage' || etat.phase === 'envoi'

/** Anneau d'encre autour du choix sélectionné : jamais en bleu, l'accent de l'app
 *  n'est pas la couleur d'un choix (et la marque du laveur n'est jamais l'accent
 *  de l'écran). Un liseré d'écart de la couleur de la surface le détache. */
export const ANNEAU_CHOIX = '0 0 0 2px var(--v2-color-surface), 0 0 0 4px var(--v2-color-encre)'

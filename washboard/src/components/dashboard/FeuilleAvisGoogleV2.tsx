'use client'

import { useState } from 'react'
import { Feuille, CHAMP, corps } from '@/components/dashboard/FeuilleV2'
import { Constat } from '@/components/dashboard/PrestationsUiV2'
import { Bloc, Pied } from '@/components/dashboard/ReglageAutomatismeV2'

// Avis Google — feuille du bas de l'écran « Apparence de ma page » (PWA).
// Rejoint « Mon site web » le 2026-10-04 : même forme (un champ, un bouton
// Enregistrer), à la demande d'Alexandre, pour que l'ID de fiche Google soit
// réglable au même endroit que sur l'écran web (`IdentiteForm`).
//
// Pas de normalisation à la saisie comme `normaliserSiteWeb` pour le site :
// Google ne documente aucun format stable pour ses identifiants de fiche
// (longueur et préfixe peuvent changer), donc aucune validation stricte côté
// client — le champ est juste collé tel quel. Voir `reviewsForWasher`,
// lib/googleReviews.ts, pour ce qu'il en est fait.

type Props = {
  /** Identifiant enregistré (`null` : aucun). */
  avisGoogle: string | null
  /** `null` si enregistré, sinon la phrase d'erreur. */
  onEnregistrer: (valeur: string | null) => Promise<string | null>
  onClose: () => void
}

export default function FeuilleAvisGoogleV2({ avisGoogle, onEnregistrer, onClose }: Props) {
  const [saisie, setSaisie] = useState(avisGoogle ?? '')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function valider(e: React.FormEvent) {
    e.preventDefault()
    if (enCours) return
    setErreur(null)
    const valeur = saisie.trim() || null
    if (valeur === avisGoogle) { onClose(); return }
    setEnCours(true)
    const retour = await onEnregistrer(valeur)
    setEnCours(false)
    if (retour) setErreur(retour)
    else onClose()
  }

  return (
    <Feuille
      titre="Avis Google"
      sousTitre="Facultatif."
      onClose={onClose}
      pied={<Pied enCours={enCours} libelle="Enregistrer" onClose={onClose} formulaire="apparence-avis-google" />}
    >
      <form id="apparence-avis-google" onSubmit={valider} noValidate>
        <Bloc titre="Identifiant de votre fiche Google (Place ID)">
          <input
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={saisie}
            onChange={e => { setSaisie(e.target.value); setErreur(null) }}
            placeholder="ChIJN1t_tDeuEmsRUsoyG83frY4"
            aria-label="Identifiant de votre fiche Google"
            aria-describedby="apparence-avis-google-aide"
            className={CHAMP}
          />
          <div id="apparence-avis-google-aide" className={`mt-2 space-y-2 text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
            <p>
              Affiche votre vraie note Google (★ note et nombre d’avis) sur votre page de
              réservation, au lieu de celle trouvée sur votre site si vous en avez un.
            </p>
            <p>
              <a
                href="https://developers.google.com/maps/documentation/places/web-service/place-id"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                Trouver l’identifiant de votre fiche
              </a>
            </p>
          </div>
        </Bloc>

        {erreur && <div className="pb-2"><Constat ton="rouge" role="alert">{erreur}</Constat></div>}
      </form>
    </Feuille>
  )
}

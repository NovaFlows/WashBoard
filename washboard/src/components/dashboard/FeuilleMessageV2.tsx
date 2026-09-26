'use client'

import { useState } from 'react'
import { Feuille, CHAMP, corps } from '@/components/dashboard/FeuilleV2'
import { Constat } from '@/components/dashboard/PrestationsUiV2'
import { Bloc, Pied } from '@/components/dashboard/ReglageAutomatismeV2'
import {
  MESSAGE_LONGUEUR_CONSEILLEE, MESSAGE_PAR_DEFAUT, messageNormalise, messageTropLong,
} from '@/lib/apparence'

// Message d'accueil — feuille du bas de l'écran « Apparence de ma page » (PWA). Une
// zone de texte, un bouton Enregistrer en pied fixe (le message n'est PAS enregistré
// au geste : on tape, on relit, on valide).
//
// Le compteur est INDICATIF : le serveur n'a aucune limite, et la page publique
// affiche le message sur une ligne d'en-tête (et l'utilise comme description de
// l'aperçu quand on partage le lien). Au-delà de 120 caractères, une phrase et un
// point ambre — jamais un blocage. Rien n'est suggéré ni enregistré d'office.

type Props = {
  /** Message enregistré (`null` : aucun). */
  message: string | null
  /** `null` si enregistré, sinon la phrase d'erreur. */
  onEnregistrer: (texte: string) => Promise<string | null>
  onClose: () => void
}

export default function FeuilleMessageV2({ message, onEnregistrer, onClose }: Props) {
  const [texte, setTexte] = useState(message ?? '')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const longueur = texte.trim().length
  const vide = longueur === 0

  async function valider(e: React.FormEvent) {
    e.preventDefault()
    if (enCours) return
    setErreur(null)
    if (messageNormalise(texte) === message) { onClose(); return }
    setEnCours(true)
    const retour = await onEnregistrer(texte)
    setEnCours(false)
    // En cas d'échec, le texte saisi reste dans le champ.
    if (retour) setErreur(retour)
    else onClose()
  }

  return (
    <Feuille
      titre="Message d’accueil"
      sousTitre="Affiché sous votre nom, en haut de votre page."
      onClose={onClose}
      fermerSurFond={false}
      pied={<Pied enCours={enCours} libelle="Enregistrer" onClose={onClose} formulaire="apparence-message" />}
    >
      <form id="apparence-message" onSubmit={valider} noValidate>
        <Bloc titre="Votre message" aide={`${longueur} / ${MESSAGE_LONGUEUR_CONSEILLEE}`}>
          <textarea
            value={texte}
            onChange={e => setTexte(e.target.value)}
            rows={4}
            aria-label="Message d’accueil"
            aria-describedby="apparence-message-aide"
            placeholder="Bienvenue ! Je me déplace chez vous pour laver votre véhicule…"
            className={`${CHAMP} !h-auto py-2.5 leading-[1.5] resize-none`}
          />
          <div id="apparence-message-aide" className="mt-2 space-y-2">
            {messageTropLong(texte) && (
              <Constat ton="ambre" role="status">
                Au-delà de {MESSAGE_LONGUEUR_CONSEILLEE} caractères, le message s’étale sur plusieurs lignes dans l’en-tête de votre page. Un message court se lit mieux.
              </Constat>
            )}
            <p className={`text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
              {vide
                ? `Si vous laissez ce champ vide, votre page affiche « ${MESSAGE_PAR_DEFAUT} ».`
                : 'Il sert aussi de description quand vous partagez votre lien.'}
            </p>
          </div>
        </Bloc>

        {erreur && <div className="pb-2"><Constat ton="rouge" role="alert">{erreur}</Constat></div>}
      </form>
    </Feuille>
  )
}

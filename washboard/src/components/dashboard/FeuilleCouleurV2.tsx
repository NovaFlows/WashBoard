'use client'

import { Feuille, PRESSION, corps } from '@/components/dashboard/FeuilleV2'
import { Constat } from '@/components/dashboard/PrestationsUiV2'
import { ANNEAU_CHOIX } from '@/components/dashboard/ApparenceUiV2'
import EchantillonCouleurV2 from '@/components/dashboard/EchantillonCouleurV2'
import { PALETTE } from '@/lib/themes'
import { COULEUR_PAR_DEFAUT, contrasteInsuffisant, estHorsNuancier } from '@/lib/apparence'

// Couleur de la marque — feuille du bas de l'écran « Apparence de ma page » (PWA).
// Les 24 couleurs de l'ancien écran, enregistrées au tap (comme lui). Pas de
// saisie libre : le serveur ne valide pas `brand_color`.
//
// Les couleurs sont des DONNÉES du laveur, pas des jetons de l'application : c'est
// la seule exception à « aucune couleur en dur ». L'anneau de sélection est
// d'encre, jamais bleu.
//
// Une couleur hors nuancier déjà enregistrée (ancienne valeur, saisie à la main)
// est montrée comme un choix de plus, sélectionné, au lieu de disparaître.
//
// Le blanc sur certaines couleurs claires se lit mal (le texte des boutons de la
// page publique est blanc) : on le dit, sans jamais interdire une couleur.

type Props = {
  /** Couleur enregistrée. */
  couleur: string | null
  /** Couleur touchée, en cours d'enregistrement. */
  enAttente: string | null
  erreur: string | null
  faite: boolean
  onChoisir: (hex: string) => void
  onClose: () => void
}

export default function FeuilleCouleurV2({ couleur, enAttente, erreur, faite, onChoisir, onClose }: Props) {
  const affichee = enAttente ?? couleur ?? COULEUR_PAR_DEFAUT
  const tuiles = couleur && estHorsNuancier(couleur) ? [...PALETTE, couleur] : PALETTE

  return (
    <Feuille
      titre="Couleur de ma marque"
      sousTitre="Elle colore les boutons et les choix sur votre page."
      onClose={onClose}
    >
      <div role="group" aria-label="Couleurs proposées" className="grid grid-cols-6 justify-items-center gap-y-3 pb-1">
        {tuiles.map(hex => {
          const choisie = hex.toLowerCase() === affichee.toLowerCase()
          return (
            <button
              key={hex}
              type="button"
              aria-pressed={choisie}
              aria-label={`Couleur ${hex}`}
              onClick={() => onChoisir(hex)}
              className="h-11 w-11 rounded-full transition-shadow motion-reduce:transition-none active:scale-[.94]"
              style={{
                background: hex,
                boxShadow: choisie ? ANNEAU_CHOIX : 'inset 0 0 0 1px var(--v2-filet-fort)',
                ...PRESSION,
              }}
            />
          )
        })}
      </div>

      {/* L'échantillon est au contact de la palette : on choisit, on voit aussitôt ce que ça
          colore sur la page. Ce n'est PAS un bouton (l'ancien « Continuer → » faisait cliquer
          des laveurs, sans effet) : la barre d'avancement et le choix coché de la page. */}
      <div className="mt-5 rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] p-4">
        <EchantillonCouleurV2 couleur={affichee} libelle={null} />
        <p className={`mt-3 text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
          Sur votre page, cette couleur colore la barre des étapes, les choix cochés et les boutons.
        </p>
      </div>

      <div className="mt-4 space-y-2 pb-2" aria-live="polite">
        {contrasteInsuffisant(affichee) && (
          <Constat ton="ambre" role="status">
            Sur cette couleur, le texte blanc des boutons se lit mal. Une teinte plus foncée sera plus lisible pour vos clients.
          </Constat>
        )}
        {erreur && <Constat ton="rouge" role="alert">{erreur}</Constat>}
        {(enAttente || (faite && !erreur)) && (
          <p className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>{enAttente ? 'Enregistrement…' : 'Enregistré.'}</p>
        )}
      </div>
    </Feuille>
  )
}

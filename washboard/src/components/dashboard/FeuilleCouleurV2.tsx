'use client'

import { Feuille, PRESSION, corps } from '@/components/dashboard/FeuilleV2'
import { Constat } from '@/components/dashboard/PrestationsUiV2'
import { ANNEAU_CHOIX } from '@/components/dashboard/ApparenceUiV2'
import EchantillonCouleurV2 from '@/components/dashboard/EchantillonCouleurV2'
import { PALETTE } from '@/lib/themes'
import { COULEUR_PAR_DEFAUT, contrasteInsuffisant, estHorsNuancier } from '@/lib/apparence'

// Couleur de la marque — feuille du bas de l'écran « Apparence de ma page » (PWA).
// Les couleurs du nuancier (`lib/themes.ts`), enregistrées au tap (comme
// l'ancien écran). Pas de saisie libre : le serveur ne valide pas `brand_color`.
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
  /** Passe bureau (2026-10-07) : posée en panneau à côté de l'aperçu plutôt qu'en fenêtre
   *  centrée — voir `Feuille` (FeuilleV2.tsx) et `ApparenceV2.tsx`. */
  panneau?: boolean
}

export default function FeuilleCouleurV2({ couleur, enAttente, erreur, faite, onChoisir, onClose, panneau }: Props) {
  const affichee = enAttente ?? couleur ?? COULEUR_PAR_DEFAUT
  const tuiles = couleur && estHorsNuancier(couleur) ? [...PALETTE, couleur] : PALETTE

  // Retouche du 2026-10-07 (Alexandre, après le passage en panneau : « réduis les points » —
  // les 24 pastilles à 44px sur 6 colonnes débordaient presque de la colonne de réglages, 300px
  // de large moins le padding de la feuille (`px-5`, 2×20px) = 260px de large, soit ~43px par
  // colonne pour un cercle de 44px). Réservé au PANNEAU (souris, bureau) : sur la feuille qui
  // monte du bas (téléphone, doigt), la cible tactile reste 44px — aucune cible de ce fichier
  // n'est réduite pour le doigt (voir le socle mobile, `.claude/agents/refonte.md`). 8 colonnes
  // de 28px tiennent sur 3 rangées au lieu de 4 : moins de hauteur ET moins de largeur.
  const taille = panneau ? 'h-7 w-7' : 'h-11 w-11'
  const colonnes = panneau ? 'grid-cols-8' : 'grid-cols-6'
  const espacement = panneau ? 'gap-x-2 gap-y-2' : 'gap-y-3'

  return (
    <Feuille
      titre="Couleur de ma marque"
      verrou="page_personnalisee"
      sousTitre="Elle colore les boutons et les choix sur votre page."
      onClose={onClose}
      panneau={panneau}
    >
      <div role="group" aria-label="Couleurs proposées" className={`grid ${colonnes} justify-items-center ${espacement} pb-1`}>
        {tuiles.map(hex => {
          const choisie = hex.toLowerCase() === affichee.toLowerCase()
          return (
            <button
              key={hex}
              type="button"
              aria-pressed={choisie}
              aria-label={`Couleur ${hex}`}
              onClick={() => onChoisir(hex)}
              className={`${taille} rounded-full transition-shadow motion-reduce:transition-none active:scale-[.94]`}
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

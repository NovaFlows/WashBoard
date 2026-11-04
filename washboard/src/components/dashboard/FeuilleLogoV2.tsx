'use client'

import { Feuille, BOUTON, PRESSION, corps, corpsFort } from '@/components/dashboard/FeuilleV2'
import { TEXTE_ROUGE } from '@/components/dashboard/PrestationsUiV2'
import { EtatEnvoi, enCoursEnvoi } from '@/components/dashboard/ApparenceUiV2'
import ApercuLogoV2 from '@/components/dashboard/ApercuLogoV2'
import type { EtatImage } from '@/hooks/useApparenceV2'
import type { ModeLogo, Retouches } from '@/lib/preparerLogo'

// Logo — feuille du bas de l'écran « Apparence de ma page » (PWA). Le laveur envoie
// SA propre image (il n'y a pas de galerie) ; le fond en est retiré automatiquement
// dans le téléphone (`preparerLogo.ts`), avec un retour à l'image d'origine si le
// détourage l'a abîmée. Cette feuille n'a AUCUN état d'envoi :
// il vit dans `useApparenceV2` (l'écran), pour que la fermer n'annule rien et ne
// fasse pas perdre un échec. Le sélecteur de fichier est lui aussi dans l'écran.

type Props = {
  nom: string
  logoUrl: string | null
  etat: EtatImage
  /** Couleur de la marque : l'aperçu montre le logo sur le vrai fond de la page. */
  couleur: string
  /** Ce que le dernier envoi a retiré : on propose de revenir en arrière. */
  retouches: Retouches
  onRefaire: (mode: Exclude<ModeLogo, 'complet'>) => void
  onChoisir: () => void
  onRetirer: () => void
  onClose: () => void
  /** Passe bureau (2026-10-07) : posée en panneau à côté de l'aperçu plutôt qu'en fenêtre
   *  centrée — voir `Feuille` (FeuilleV2.tsx) et `ApparenceV2.tsx`. */
  panneau?: boolean
}

export default function FeuilleLogoV2({ nom, logoUrl, etat, couleur, retouches, onRefaire, onChoisir, onRetirer, onClose, panneau }: Props) {
  const occupe = enCoursEnvoi(etat)

  return (
    <Feuille
      titre="Logo"
      verrou="page_personnalisee"
      sousTitre="Il s’affiche en haut de votre page de réservation."
      onClose={onClose}
      panneau={panneau}
      pied={
        <div className="space-y-1">
          <button
            type="button"
            onClick={onChoisir}
            disabled={occupe}
            className={`${BOUTON} w-full text-white`}
            style={{ background: 'var(--v2-color-accent)', ...PRESSION }}
          >
            {occupe ? 'En cours…' : logoUrl ? 'Changer le logo' : 'Choisir une image'}
          </button>
          {logoUrl && (
            <button
              type="button"
              onClick={onRetirer}
              disabled={occupe}
              className={`flex h-11 w-full items-center justify-center text-[15px] ${corpsFort} disabled:opacity-50`}
              style={{ color: TEXTE_ROUGE }}
            >
              Retirer le logo
            </button>
          )}
        </div>
      }
    >
      <ApercuLogoV2 logoUrl={logoUrl} nom={nom} couleur={couleur} />
      <p className={`mt-3 text-[14px] leading-snug ${corps}`}>
        {logoUrl
          ? 'C’est ce que voient vos clients en haut de votre page : le logo entier.'
          : 'Pas encore de logo : vos clients voient les initiales de votre nom.'}
      </p>

      <p className={`mt-4 text-[13.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
        Le fond de l’image est retiré automatiquement, sur votre téléphone.
      </p>
      {!occupe && retouches.creuxRetires && (
        <button
          type="button"
          onClick={() => onRefaire('sans-creux')}
          className={`mt-2 block text-left text-[14px] underline underline-offset-2 ${corpsFort} text-[color:var(--v2-color-encre)]`}
        >
          Une partie du logo a disparu ? La remettre
        </button>
      )}
      {!occupe && retouches.fondRetire && (
        <button
          type="button"
          onClick={() => onRefaire('original')}
          className={`mt-2 block text-left text-[14px] underline underline-offset-2 ${corpsFort} text-[color:var(--v2-color-encre)]`}
        >
          Le résultat ne vous plaît pas ? Garder le fond d’origine
        </button>
      )}

      <div className="mt-4 min-h-[22px] pb-2" aria-live="polite">
        <EtatEnvoi etat={etat} texteFait="Logo mis en ligne." />
      </div>
    </Feuille>
  )
}

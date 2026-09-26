'use client'

import { Feuille, BOUTON, PRESSION, corps, corpsFort } from '@/components/dashboard/FeuilleV2'
import { TEXTE_ROUGE } from '@/components/dashboard/PrestationsUiV2'
import { EtatEnvoi, enCoursEnvoi } from '@/components/dashboard/ApparenceUiV2'
import type { EtatImage } from '@/hooks/useApparenceV2'

// Logo — feuille du bas de l'écran « Apparence de ma page » (PWA). Le laveur envoie
// SA propre image (il n'y a pas de galerie) ; le fond en est retiré automatiquement
// dans le téléphone, comme sur l'ancien écran. Cette feuille n'a AUCUN état d'envoi :
// il vit dans `useApparenceV2` (l'écran), pour que la fermer n'annule rien et ne
// fasse pas perdre un échec. Le sélecteur de fichier est lui aussi dans l'écran.

type Props = {
  nom: string
  logoUrl: string | null
  etat: EtatImage
  onChoisir: () => void
  onRetirer: () => void
  onClose: () => void
}

export default function FeuilleLogoV2({ nom, logoUrl, etat, onChoisir, onRetirer, onClose }: Props) {
  const occupe = enCoursEnvoi(etat)

  return (
    <Feuille
      titre="Logo"
      sousTitre="Il s’affiche en haut de votre page de réservation."
      onClose={onClose}
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
      <div className="flex items-center gap-4">
        {/* Même carré rogné que sur la vraie page (48 px, `object-cover`), en plus grand. */}
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- adresse Supabase, comme la vraie page
          <img src={logoUrl} alt="Votre logo" className="h-[88px] w-[88px] shrink-0 rounded-[18px] border border-[color:var(--v2-filet)] object-cover" />
        ) : (
          <div
            aria-hidden
            className={`flex h-[88px] w-[88px] shrink-0 select-none items-center justify-center rounded-[18px] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-filet)] text-[34px] text-[color:var(--v2-color-gris)] ${corpsFort}`}
          >
            {nom.charAt(0).toUpperCase()}
          </div>
        )}
        <p className={`min-w-0 text-[14px] leading-snug ${corps}`}>
          {logoUrl
            ? 'Il est affiché en petit carré : les bords d’une image large sont coupés.'
            : 'Pas encore de logo : vos clients voient la première lettre de votre nom.'}
        </p>
      </div>

      <p className={`mt-4 text-[13.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
        Le fond de l’image est retiré automatiquement, sur votre téléphone. La première fois, c’est plus long.
      </p>

      <div className="mt-4 min-h-[22px] pb-2" aria-live="polite">
        <EtatEnvoi etat={etat} texteFait="Logo mis en ligne." />
      </div>
    </Feuille>
  )
}

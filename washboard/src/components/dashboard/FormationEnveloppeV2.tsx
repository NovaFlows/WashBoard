'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { corps, titre } from '@/components/dashboard/FeuilleV2'
import { FilAriane } from '@/components/dashboard/ParametresFormV2'
import type { ReglagesListeProps } from '@/components/dashboard/ListeReglagesV2'
import { useGrandEcran } from '@/hooks/useGrandEcran'

// Cadre commun des écrans « Formation » (branche feat/formation, 2026-11-10) : même patron que
// `GuideV2` — en-tête avec retour sur téléphone, fil d'Ariane sur grand écran, liste « Plus » à
// gauche sur grand écran. Aucun écran de la formation ne redessine ce cadre.
//
// OÙ VIT L'ONGLET (décision d'Alexandre, 2026-11-11) : uniquement dans le rail de gauche, au-dessus de
// « Plus » ; plus aucune ligne « Formation » dans « Réglages ».

type Props = {
  /** Plus utilisée : Formation n'est plus un sous-écran de « Réglages » (2026-11-11). */
  liste?: ReglagesListeProps
  titre: string
  sousTitre?: string
  /** Où ramène le chevron / le fil d'Ariane. Absent sur l'écran d'accueil de la Formation (destination à part entière). */
  retour?: { href: string; label: string }
  children: React.ReactNode
}

export default function FormationEnveloppeV2({ titre: intitule, sousTitre, retour, children }: Props) {
  const grandEcran = useGrandEcran()

  const contenu = (
    <div className={grandEcran ? '[font-family:var(--font-archivo)]' : 'max-w-3xl mx-auto -mx-3 sm:-mx-4 -mt-6 px-3 sm:px-4 pt-3 pb-6 bg-[color:var(--v2-color-fond)] text-[color:var(--v2-color-encre)] [font-family:var(--font-archivo)]'}>
      {grandEcran ? (
        <div className="pb-3">
          {retour && <FilAriane label={retour.label} href={retour.href} />}
          <h1 className={`text-[20px] leading-none ${titre}`}>{intitule}</h1>
          {sousTitre && <p className={`mt-1 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>{sousTitre}</p>}
        </div>
      ) : (
        <div className="flex items-center gap-1 pb-2">
          {retour && (
            <Link
              href={retour.href}
              aria-label={`Retour : ${retour.label}`}
              className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center text-[color:var(--v2-color-encre)]"
            >
              <ChevronLeft size={22} strokeWidth={2} />
            </Link>
          )}
          <div className="min-w-0 flex-1">
            <h1 className={`text-[24px] leading-none ${titre}`}>{intitule}</h1>
            {sousTitre && <p className={`mt-1.5 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>{sousTitre}</p>}
          </div>
        </div>
      )}
      <div className="space-y-5 pt-1">{children}</div>
    </div>
  )

  // Grand écran : plein cadre, comme « Aujourd'hui » ou « Chiffres » — ni liste « Plus » à gauche ni largeur plafonnée.
  return contenu
}

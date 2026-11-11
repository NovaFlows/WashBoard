'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { corps, titre } from '@/components/dashboard/FeuilleV2'
import { FilAriane } from '@/components/dashboard/ParametresFormV2'
import ListeReglagesV2, { type ReglagesListeProps } from '@/components/dashboard/ListeReglagesV2'
import { useGrandEcran } from '@/hooks/useGrandEcran'

// Cadre commun des écrans « Formation » (branche feat/formation, 2026-11-10) : même patron que
// `GuideV2` — en-tête avec retour sur téléphone, fil d'Ariane sur grand écran, liste « Plus » à
// gauche sur grand écran. Aucun écran de la formation ne redessine ce cadre.
//
// OÙ VIT L'ONGLET : pour l'instant dans « Réglages » (ligne « Formation »), pas dans la barre du
// bas — celle-ci est figée à quatre destinations + le bouton central par la refonte (voir
// BarreBasV2.tsx). En faire une destination à part entière est LA décision à prendre avec
// Alexandre (voir docs/FORMATION.md, « Questions ouvertes »).

type Props = {
  liste: ReglagesListeProps
  titre: string
  sousTitre?: string
  /** Où ramène le chevron / le fil d'Ariane. */
  retour: { href: string; label: string }
  children: React.ReactNode
}

export default function FormationEnveloppeV2({ liste, titre: intitule, sousTitre, retour, children }: Props) {
  const grandEcran = useGrandEcran()

  const contenu = (
    <div className={grandEcran ? '[font-family:var(--font-archivo)]' : 'max-w-3xl mx-auto -mx-3 sm:-mx-4 -mt-6 px-3 sm:px-4 pt-3 pb-6 bg-[color:var(--v2-color-fond)] text-[color:var(--v2-color-encre)] [font-family:var(--font-archivo)]'}>
      {grandEcran ? (
        <div className="pb-3">
          <FilAriane label={retour.label} href={retour.href} />
          <h1 className={`text-[20px] leading-none ${titre}`}>{intitule}</h1>
          {sousTitre && <p className={`mt-1 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>{sousTitre}</p>}
        </div>
      ) : (
        <div className="flex items-center gap-1 pb-2">
          <Link
            href={retour.href}
            aria-label={`Retour : ${retour.label}`}
            className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center text-[color:var(--v2-color-encre)]"
          >
            <ChevronLeft size={22} strokeWidth={2} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className={`text-[24px] leading-none ${titre}`}>{intitule}</h1>
            {sousTitre && <p className={`mt-1.5 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>{sousTitre}</p>}
          </div>
        </div>
      )}
      <div className="space-y-5 pt-1">{children}</div>
    </div>
  )

  if (!grandEcran) return contenu

  return (
    <div className="flex items-start gap-5">
      <div className="sticky top-0 w-[320px] shrink-0 max-h-[calc(100vh-60px)] overflow-y-auto">
        <ListeReglagesV2 {...liste} selection="reglages" />
      </div>
      <div className="min-w-0 max-w-[720px] flex-1">{contenu}</div>
    </div>
  )
}

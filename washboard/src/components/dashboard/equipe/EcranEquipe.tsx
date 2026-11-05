'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { corps, corpsFort, titre } from '@/components/dashboard/FeuilleV2'
import { useGrandEcran } from '@/hooks/useGrandEcran'

// Cadre commun des écrans de l'espace équipe (2026-11-05) : mêmes jetons et même
// en-tête que les écrans de « Plus » (voir ReglagesV2.tsx) — fond papier, Archivo,
// chevron de retour sur téléphone. Sur ordinateur, une colonne de lecture centrée.

export default function EcranEquipe({
  titre: intitule, sousTitre, retour, action, large = false, children,
}: {
  titre: string
  sousTitre?: string
  retour: { href: string; label: string }
  /** Bouton à droite de l'en-tête (« … » de la fiche, par exemple). */
  action?: React.ReactNode
  /** Sur ordinateur, pleine largeur (tableau de bord) au lieu d'une colonne de lecture. */
  large?: boolean
  children: React.ReactNode
}) {
  const grandEcran = useGrandEcran()
  return (
    <div
      className={grandEcran
        ? `${large ? 'max-w-[1180px]' : 'max-w-[720px]'} mx-auto pb-10 text-[color:var(--v2-color-encre)] [font-family:var(--font-archivo)]`
        : 'max-w-3xl mx-auto -mx-3 sm:-mx-4 -mt-6 px-3 sm:px-4 pt-3 pb-10 min-h-screen bg-[color:var(--v2-color-fond)] text-[color:var(--v2-color-encre)] [font-family:var(--font-archivo)]'}
    >
      {grandEcran && (
        <Link href={retour.href} className={`inline-flex items-center gap-1 mb-3 text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)] hover:text-[color:var(--v2-color-encre)]`}>
          <ChevronLeft size={16} strokeWidth={2} aria-hidden />
          {retour.label}
        </Link>
      )}
      <div className="flex items-center gap-1 pb-5">
        {!grandEcran && (
          <Link href={retour.href} aria-label={`Retour à ${retour.label}`} className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center text-[color:var(--v2-color-encre)]">
            <ChevronLeft size={22} strokeWidth={2} />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h1 className={`truncate leading-none ${grandEcran ? 'text-[22px]' : 'text-[24px]'} ${titre}`}>{intitule}</h1>
          {sousTitre && <p className={`mt-1.5 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>{sousTitre}</p>}
        </div>
        {action}
      </div>
      <div className="space-y-6">{children}</div>
    </div>
  )
}

/** Titre de section + carte : le patron de toutes les listes de la refonte. */
export function Section({ titre: intitule, action, children }: { titre: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center justify-between px-0.5 pb-2">
        <h2 className={`text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>{intitule}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

/** Carte de surface, sans découpage en lignes (texte libre, chiffres). */
export function Carte({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] ${className}`}>
      {children}
    </div>
  )
}

/** Libellé à gauche, valeur à droite — pour les fiches (contact, configuration). */
export function LigneInfo({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 min-h-[44px] py-2.5">
      <span className={`shrink-0 text-[14px] ${corps} text-[color:var(--v2-color-gris)]`}>{libelle}</span>
      <span className={`min-w-0 text-right text-[14.5px] leading-snug ${corps} break-words`}>{children}</span>
    </div>
  )
}

/** Initiales sur pastille d'encre, comme la carte d'identité de « Plus ». */
export function Initiales({ nom, taille = 40 }: { nom: string; taille?: number }) {
  const mots = nom.trim().split(/\s+/).filter(Boolean)
  const texte = mots.length === 0 ? '?' : mots.length === 1 ? mots[0].slice(0, 2).toUpperCase() : (mots[0][0] + mots[mots.length - 1][0]).toUpperCase()
  return (
    <span
      aria-hidden
      className={`shrink-0 rounded-[12px] bg-[color:var(--v2-color-encre)] text-[color:var(--v2-color-surface)] flex items-center justify-center ${corpsFort} tracking-tight`}
      style={{ width: taille, height: taille, fontSize: Math.round(taille * 0.38) }}
    >
      {texte}
    </span>
  )
}

/** Point de couleur d'un état (règle de la refonte : le point porte la couleur, le texte reste en encre). */
export function Point({ ton }: { ton: 'vert' | 'ambre' | 'rouge' | 'gris' }) {
  const couleur = { vert: 'var(--v2-color-vert)', ambre: 'var(--v2-color-ambre)', rouge: 'var(--v2-color-rouge)', gris: 'var(--v2-color-gris)' }[ton]
  return <span aria-hidden className="inline-block h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: couleur }} />
}

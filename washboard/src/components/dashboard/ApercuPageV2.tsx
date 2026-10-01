'use client'

import type { CSSProperties } from 'react'
import { corps, corpsFort } from '@/components/dashboard/FeuilleV2'
import EchantillonCouleurV2 from '@/components/dashboard/EchantillonCouleurV2'
import { getBgStyle } from '@/lib/themes'
import { COULEUR_PAR_DEFAUT, MESSAGE_PAR_DEFAUT } from '@/lib/apparence'

// Aperçu de la page de réservation d'un laveur, en tête de l'écran « Apparence de
// ma page » (PWA). C'est une APPROXIMATION honnête de l'en-tête de
// `(public)/book/[slug]/page.tsx`, pas une copie fidèle au pixel :
//  - même fond (`getBgStyle`, avec son voile noir de 52 % pour la lisibilité) ;
//  - même logo : carré de 48 px, rogné (`object-cover`) — l'ancien aperçu le montrait
//    en `object-contain`, entier, alors que la vraie page en coupe les bords ;
//  - même initiale à défaut de logo, même « Réservation en ligne » à défaut de message ;
//  - la couleur de la marque, montrée par la barre des étapes et le choix coché de la vraie
//    page (et non par un faux bouton : il faisait cliquer sans rien déclencher).
// Ni verre ni flou : le voile de l'en-tête est un simple aplat.
//
// Sur un fond « Original », la vraie page suit le thème clair/sombre du client : ici
// l'aperçu suit celui de l'application. Sur un fond choisi (dégradé ou photo), la
// page est toujours sombre et son texte toujours blanc — c'est pourquoi le blanc
// est écrit en dur dans ce cas, comme dans la page publique.

type Props = {
  nom: string
  logoUrl: string | null
  message: string | null
  couleur: string | null
  fond: string | null
}

export default function ApercuPageV2({ nom, logoUrl, message, couleur, fond }: Props) {
  const styleFond = getBgStyle(fond)
  const avecFond = !!styleFond
  // `getBgStyle` fixe l'image à la fenêtre (`fixed`) : dans un petit cadre, elle
  // s'afficherait décalée ou coupée. Le reste du style est gardé tel quel.
  const style: CSSProperties | undefined = styleFond ? { ...styleFond, backgroundAttachment: 'scroll' } : undefined
  const accent = couleur ?? COULEUR_PAR_DEFAUT

  return (
    <div
      role="group"
      aria-label="Aperçu de votre page de réservation"
      className="overflow-hidden rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet-fort)]"
    >
      <div className={avecFond ? '' : 'bg-[color:var(--v2-color-fond)]'} style={style}>
        <div
          className={`flex items-center gap-3 border-b px-4 py-3 ${
            avecFond ? 'border-white/10 bg-black/30' : 'border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)]'
          }`}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- adresse Supabase, comme la vraie page
            <img src={logoUrl} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
          ) : (
            <div
              aria-hidden
              className={`flex h-12 w-12 shrink-0 select-none items-center justify-center rounded-xl border text-xl ${corpsFort} ${
                avecFond
                  ? 'border-white/20 bg-white/10 text-white'
                  : 'border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-filet)] text-[color:var(--v2-color-gris)]'
              }`}
            >
              {nom.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p
              className={`truncate text-[22px] leading-none tracking-tight ${corps} ${
                avecFond ? 'text-white' : 'text-[color:var(--v2-color-encre)]'
              }`}
              style={{ fontWeight: 800 }}
            >
              {nom}
            </p>
            <p
              className={`mt-1.5 line-clamp-3 text-xs leading-tight ${corps} ${
                avecFond ? 'text-white/60' : 'text-[color:var(--v2-color-gris)]'
              }`}
            >
              {message || MESSAGE_PAR_DEFAUT}
            </p>
          </div>
        </div>

        <div className="flex min-h-[88px] items-center px-4 py-4">
          <EchantillonCouleurV2 couleur={accent} clair={avecFond} />
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isDesignMobile } from '@/lib/designMobile'
import { estEcranRail } from '@/lib/grandEcran'
import { bureauForceEnDev } from '@/hooks/useDashboardV2'
import ApparenceV2 from '@/components/dashboard/ApparenceV2'
import type { ReglagesApparence } from '@/hooks/useApparenceV2'
import type { ReglagesListeProps } from '@/components/dashboard/ListeReglagesV2'

// Point d'entrée de « Apparence de ma page » — destination NEUVE de la refonte 2026
// (troisième cas de refonte.md, même schéma que Horaires.tsx et Prestations.tsx) :
// côté site, le logo, la couleur, le fond, le message et le site web se règlent dans
// l'onglet « Identité » de `/dashboard/admin` (`IdentiteForm`, inchangé). Cette route-
// ci n'existe dans aucun menu v1 : le site n'a jamais de raison d'y arriver.
//
// Garde-fou pour qui la tape quand même (lien copié, favori) depuis un navigateur
// classique : renvoi vers l'onglet v1 équivalent plutôt qu'un écran v2 — décision
// d'Alexandre, 2026-09-22 : v1 sur le site, v2 seulement dans la PWA installée, sans
// exception. Trois états, jamais de flash de contenu v2 côté site, rien pendant la
// vérification.
//
// RÉOUVERT le 2026-10-06 (passe « Plus bureau ») pour le cas SITE + grand écran, comme
// `Chiffres.tsx` : un laveur qui ouvre le site (pas la PWA) sur un écran assez large, avec
// `washer.beta_refonte` actif, voit lui aussi cet écran plutôt que d'être renvoyé vers
// `/dashboard/admin#identite`. Décidé une seule fois, au montage (voir Chiffres.tsx pour le
// raisonnement complet).
type Statut = 'verification' | 'v2' | 'v1'

type Props = {
  nom: string
  slug: string
  initial: ReglagesApparence
  /** Liste « Plus », affichée à gauche sur grand écran (voir `ListeReglagesV2.tsx`) —
   *  ignorée sur téléphone, où cet écran reste plein écran. */
  liste: ReglagesListeProps
  /** `washer.beta_refonte` — garde-fou temporaire du cas « site, grand écran ». Sans effet
   *  dans la PWA, où cet écran s'affiche déjà sans condition, largeur quelconque. */
  betaRefonte?: boolean | null
}

export default function Apparence({ betaRefonte, ...props }: Props) {
  const router = useRouter()
  const [statut, setStatut] = useState<Statut>('verification')

  useEffect(() => {
    const pwa = isDesignMobile()
    const bureau = estEcranRail() && (!!betaRefonte || bureauForceEnDev())
    setStatut(pwa || bureau ? 'v2' : 'v1')
  }, [betaRefonte])

  useEffect(() => {
    if (statut === 'v1') router.replace('/dashboard/admin#identite')
  }, [statut, router])

  if (statut !== 'v2') return null

  return <ApparenceV2 {...props} />
}

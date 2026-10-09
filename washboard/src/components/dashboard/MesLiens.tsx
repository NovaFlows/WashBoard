'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isDesignMobile } from '@/lib/designMobile'
import { estEcranRail } from '@/lib/grandEcran'
import { bureauForceEnDev } from '@/hooks/useDashboardV2'
import MesLiensV2 from '@/components/dashboard/MesLiensV2'
import type { ReglagesListeProps } from '@/components/dashboard/ListeReglagesV2'

// Point d'entrée de « Mes liens » — destination NEUVE de la refonte 2026 (même schéma
// que Horaires.tsx et Prestations.tsx) : côté site, les liens par réseau se trouvent
// au bas de `/dashboard/crm` (`TrafficSourceLinks`, inchangé). Cette route-ci n'existe
// dans aucun menu v1 : le site n'a jamais de raison d'y arriver.
//
// Garde-fou pour qui la tape quand même depuis un navigateur classique : renvoi vers
// l'écran v1 équivalent — v1 sur le site, v2 seulement dans la PWA installée, sans
// exception (décision d'Alexandre, 2026-09-22). Trois états, jamais de flash de
// contenu v2 côté site, rien pendant la vérification.
//
// RÉOUVERT le 2026-10-06 (passe « Plus bureau ») pour le cas SITE + grand écran, comme
// `Chiffres.tsx` : voir son en-tête pour le raisonnement complet (décidé une seule fois, au
// montage).
type Statut = 'verification' | 'v2' | 'v1'

type Props = {
  slug: string
  /** Liste « Plus », affichée à gauche sur grand écran (voir `ListeReglagesV2.tsx`). */
  liste: ReglagesListeProps
  /** `washer.beta_refonte` — garde-fou temporaire du cas « site, grand écran ». */
  betaRefonte?: boolean | null
}

export default function MesLiens({ slug, liste, betaRefonte }: Props) {
  const router = useRouter()
  const [statut, setStatut] = useState<Statut>('verification')

  useEffect(() => {
    const pwa = isDesignMobile()
    const bureau = estEcranRail() && (!!betaRefonte || bureauForceEnDev())
    setStatut(pwa || bureau ? 'v2' : 'v1')
  }, [betaRefonte])

  useEffect(() => {
    if (statut === 'v1') router.replace('/dashboard/crm')
  }, [statut, router])

  if (statut !== 'v2') return null

  return <MesLiensV2 slug={slug} liste={liste} />
}

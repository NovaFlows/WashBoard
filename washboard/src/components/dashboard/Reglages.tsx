'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isDesignMobile } from '@/lib/designMobile'
import { estEcranRail } from '@/lib/grandEcran'
import { bureauForceEnDev } from '@/hooks/useDashboardV2'
import ReglagesV2 from '@/components/dashboard/ReglagesV2'
import type { ReglagesListeProps } from '@/components/dashboard/ListeReglagesV2'
import type { SetupProgress } from '@/lib/setupProgress'

// Point d'entrée de « Réglages » — destination NEUVE de la refonte 2026 (même schéma que
// `Horaires.tsx`/`Prestations.tsx`). Côté site, ces réglages vivent dans l'ancien formulaire
// complet : le navigateur classique y est renvoyé.
//
// RÉOUVERT le 2026-10-06 (passe « Plus bureau, second lot ») pour le cas SITE + grand écran,
// comme `Apparence.tsx`/`Horaires.tsx` : voir leur en-tête pour le raisonnement complet
// (décidé une seule fois, au montage — jamais de flash de contenu v2 côté site).
type Statut = 'verification' | 'v2' | 'v1'

type Props = {
  /** Liste « Plus », affichée à gauche sur grand écran (voir `ListeReglagesV2.tsx`). */
  liste: ReglagesListeProps
  /** `washer.beta_refonte` — garde-fou temporaire du cas « site, grand écran ». */
  betaRefonte?: boolean | null
  /** Carte « Configuration de votre compte » (voir `ReglagesV2.tsx`). */
  progress: SetupProgress
}

export default function Reglages({ liste, betaRefonte, progress }: Props) {
  const router = useRouter()
  const [statut, setStatut] = useState<Statut>('verification')

  useEffect(() => {
    const pwa = isDesignMobile()
    const bureau = estEcranRail() && (!!betaRefonte || bureauForceEnDev())
    setStatut(pwa || bureau ? 'v2' : 'v1')
  }, [betaRefonte])

  useEffect(() => {
    if (statut === 'v1') router.replace('/dashboard/parametres/tout')
  }, [statut, router])

  if (statut !== 'v2') return null

  return <ReglagesV2 liste={liste} progress={progress} />
}

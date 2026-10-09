'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isDesignMobile } from '@/lib/designMobile'
import { estEcranRail } from '@/lib/grandEcran'
import { bureauForceEnDev } from '@/hooks/useDashboardV2'
import DepensesV2 from '@/components/dashboard/DepensesV2'

// Point d'entrée de « Dépenses » — destination NEUVE de la refonte 2026 (même schéma que
// Prestations.tsx et Horaires.tsx) : côté site, les frais se saisissent dans l'écran de
// comptabilité (`/dashboard/compta`, `ComptaDashboard`, inchangé). Cette route-ci n'existe
// dans aucun menu v1 : le site n'a jamais de raison d'y arriver.
//
// Garde-fou pour qui la tape quand même depuis un navigateur classique : renvoi vers l'écran
// v1 équivalent — v1 sur le site, v2 seulement dans la PWA installée, sans exception
// (décision d'Alexandre, 2026-09-22). Trois états, jamais de flash de contenu v2 côté site.
//
// REOUVERT le 2026-10-06 (passe « Chiffres bureau ») — même raisonnement que Chiffres.tsx (lire
// son en-tête) : site + grand écran + `washer.beta_refonte` voit aussi cet écran plutôt que
// `/dashboard/compta`, décidé une seule fois au montage, jamais recalculé au redimensionnement.
type Statut = 'verification' | 'v2' | 'v1'

export default function Depenses({ betaRefonte }: {
  /** `washer.beta_refonte` — garde-fou temporaire du cas « site, grand écran » (voir
   *  `useDashboardV2.ts`). Sans effet dans la PWA. */
  betaRefonte?: boolean | null
}) {
  const router = useRouter()
  const [statut, setStatut] = useState<Statut>('verification')

  useEffect(() => {
    const pwa = isDesignMobile()
    const bureau = estEcranRail() && (!!betaRefonte || bureauForceEnDev())
    setStatut(pwa || bureau ? 'v2' : 'v1')
  }, [betaRefonte])

  useEffect(() => {
    if (statut === 'v1') router.replace('/dashboard/compta')
  }, [statut, router])

  if (statut !== 'v2') return null

  return <DepensesV2 />
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isDesignMobile } from '@/lib/designMobile'
import { estEcranRail } from '@/lib/grandEcran'
import { bureauForceEnDev } from '@/hooks/useDashboardV2'
import DocumentsV2 from '@/components/dashboard/DocumentsV2'

// Point d'entrée de « Devis et factures » — destination NEUVE de la refonte 2026 (même schéma
// que `Depenses.tsx`). Côté site, cet écran n'existe pas encore : le laveur est renvoyé vers
// sa liste de factures, d'où il ne manque que la création à la main.
//
// Garde-fou pour qui tape l'adresse depuis un navigateur classique — v1 sur le site, v2
// seulement dans la PWA installée, sans exception (décision d'Alexandre, 2026-09-22). Trois
// états, jamais de flash de contenu v2 côté site.
//
// REOUVERT le 2026-10-07 (passe « Documents bureau ») pour le cas SITE + grand écran, même
// raisonnement que Chiffres.tsx/Depenses.tsx (lire leur en-tête) : un laveur qui ouvre le site
// (pas la PWA) sur un écran assez large, avec `washer.beta_refonte` actif, voit lui aussi la
// présentation v2 (liste + recherche + filtres + fiche à côté) plutôt que d'être renvoyé vers
// `/dashboard/factures`. Décidé une seule fois au montage — jamais recalculé au
// redimensionnement, sinon réduire la fenêtre sous le seuil en pleine lecture d'un document
// renverrait le laveur vers l'ancien écran en plein milieu de sa consultation.
type Statut = 'verification' | 'pwa-ou-bureau' | 'site'

export default function Documents({ prestations, nomLaveur, betaRefonte }: {
  prestations: { id: string; name: string; price: number }[]
  nomLaveur: string
  /** `washer.beta_refonte` — garde-fou temporaire du cas « site, grand écran » (voir
   *  `useDashboardV2.ts`). Sans effet dans la PWA, où cet écran s'affiche déjà sans condition. */
  betaRefonte?: boolean | null
}) {
  const router = useRouter()
  const [statut, setStatut] = useState<Statut>('verification')

  useEffect(() => {
    const pwa = isDesignMobile()
    const bureau = estEcranRail() && (!!betaRefonte || bureauForceEnDev())
    setStatut(pwa || bureau ? 'pwa-ou-bureau' : 'site')
  }, [betaRefonte])

  useEffect(() => {
    if (statut === 'site') router.replace('/dashboard/factures')
  }, [statut, router])

  if (statut !== 'pwa-ou-bureau') return null

  return <DocumentsV2 prestations={prestations} nomLaveur={nomLaveur} />
}

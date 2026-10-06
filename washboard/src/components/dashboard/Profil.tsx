'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isPwaStandalone } from '@/lib/pwaStandalone'
import { estEcranRail } from '@/lib/grandEcran'
import { bureauForceEnDev } from '@/hooks/useDashboardV2'
import ProfilV2 from '@/components/dashboard/ProfilV2'
import type { Washer } from '@/types'

// Point d'entrée de « Mon profil » — destination NEUVE de la refonte 2026 (même schéma que
// Prestations.tsx et Horaires.tsx) : côté site, ces réglages vivent dans le formulaire complet
// (`/dashboard/parametres/tout`, carte « Mon profil » et suivantes). Cette route-ci n'existe
// dans aucun menu v1 : le site n'a jamais de raison d'y arriver.
//
// Garde-fou pour qui la tape quand même (lien copié, favori) depuis un navigateur classique :
// renvoi vers l'écran v1 équivalent — v1 sur le site, v2 seulement dans la PWA installée, sans
// exception (décision d'Alexandre, 2026-09-22). Trois états, jamais de flash de contenu v2
// côté site, rien pendant la vérification.
//
// RÉOUVERT le 2026-10-06 (passe « Plus bureau ») pour le cas SITE + grand écran, comme
// `Chiffres.tsx` : voir son en-tête pour le raisonnement complet (décidé une seule fois, au
// montage).
type Statut = 'verification' | 'v2' | 'v1'

type Props = {
  washer: Washer
  email: string
  peutEquipe: boolean
  /** `washer.beta_refonte` — garde-fou temporaire du cas « site, grand écran ». */
  betaRefonte?: boolean | null
}

export default function Profil({ betaRefonte, ...props }: Props) {
  const router = useRouter()
  const [statut, setStatut] = useState<Statut>('verification')

  useEffect(() => {
    const pwa = isPwaStandalone()
    const bureau = estEcranRail() && (!!betaRefonte || bureauForceEnDev())
    setStatut(pwa || bureau ? 'v2' : 'v1')
  }, [betaRefonte])

  useEffect(() => {
    if (statut === 'v1') router.replace('/dashboard/parametres/tout#profil')
  }, [statut, router])

  if (statut !== 'v2') return null

  return <ProfilV2 {...props} />
}

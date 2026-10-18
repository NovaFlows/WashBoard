'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isDesignMobile } from '@/lib/designMobile'
import { estEcranRail } from '@/lib/grandEcran'
import { bureauAutorise } from '@/hooks/useDashboardV2'
import PromotionsV2 from '@/components/dashboard/PromotionsV2'
import type { ReglagesListeProps } from '@/components/dashboard/ListeReglagesV2'

// Point d'entrée de « Promotions » : même garde-fou que `MesLiens.tsx` (écran v2 seulement ;
// l'ancien tableau de bord n'a pas cet écran et renvoie vers ses réglages).
type Statut = 'verification' | 'v2' | 'v1'

type Props = {
  slug: string
  services: { id: string; name: string }[]
  liste: ReglagesListeProps
  betaRefonte?: boolean | null
}

export default function Promotions({ slug, services, liste, betaRefonte }: Props) {
  const router = useRouter()
  const [statut, setStatut] = useState<Statut>('verification')

  useEffect(() => {
    const pwa = isDesignMobile()
    const bureau = estEcranRail() && bureauAutorise(betaRefonte)
    setStatut(pwa || bureau ? 'v2' : 'v1')
  }, [betaRefonte])

  useEffect(() => {
    if (statut === 'v1') router.replace('/dashboard/parametres')
  }, [statut, router])

  if (statut !== 'v2') return null
  return <PromotionsV2 slug={slug} services={services} liste={liste} />
}

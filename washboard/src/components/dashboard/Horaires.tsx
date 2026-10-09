'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isDesignMobile } from '@/lib/designMobile'
import { estEcranRail } from '@/lib/grandEcran'
import { bureauForceEnDev } from '@/hooks/useDashboardV2'
import HorairesV2 from '@/components/dashboard/HorairesV2'
import type { Availability, Unavailability } from '@/types'
import type { ReglagesListeProps } from '@/components/dashboard/ListeReglagesV2'

// Point d'entrée de « Horaires » — destination NEUVE de la refonte 2026 (troisième
// cas de refonte.md, même schéma que Prestations.tsx et Chiffres.tsx) : côté site,
// les horaires et les congés se gèrent dans l'onglet « Disponibilités » de
// `/dashboard/admin` (`DisponibilitesManager`, inchangé). Cette route-ci n'existe
// dans aucun menu v1 : le site n'a jamais de raison d'y arriver.
//
// Garde-fou pour qui la tape quand même (lien copié, favori) depuis un
// navigateur classique : renvoi vers l'onglet v1 équivalent plutôt qu'un écran
// v2 — décision d'Alexandre, 2026-09-22 : v1 sur le site, v2 seulement dans la
// PWA installée, sans exception. Trois états, jamais de flash de contenu v2 côté
// site, rien pendant la vérification.
//
// RÉOUVERT le 2026-10-06 (passe « Plus bureau ») pour le cas SITE + grand écran, comme
// `Chiffres.tsx` : voir son en-tête pour le raisonnement complet (décidé une seule fois, au
// montage).
type Statut = 'verification' | 'v2' | 'v1'

type Props = {
  availabilities: Availability[]
  unavailabilities: Unavailability[]
  teamSize: number
  jourMemeAutorise: boolean
  adresseDepart: boolean
  lectureIncomplete: boolean
  /** Liste « Plus », affichée à gauche sur grand écran (voir `ListeReglagesV2.tsx`). */
  liste: ReglagesListeProps
  /** `washer.beta_refonte` — garde-fou temporaire du cas « site, grand écran ». */
  betaRefonte?: boolean | null
}

export default function Horaires({ betaRefonte, ...props }: Props) {
  const router = useRouter()
  const [statut, setStatut] = useState<Statut>('verification')

  useEffect(() => {
    const pwa = isDesignMobile()
    const bureau = estEcranRail() && (!!betaRefonte || bureauForceEnDev())
    setStatut(pwa || bureau ? 'v2' : 'v1')
  }, [betaRefonte])

  useEffect(() => {
    if (statut === 'v1') router.replace('/dashboard/admin#disponibilites')
  }, [statut, router])

  if (statut !== 'v2') return null

  return <HorairesV2 {...props} />
}

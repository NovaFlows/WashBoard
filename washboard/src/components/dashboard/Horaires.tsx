'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isPwaStandalone } from '@/lib/pwaStandalone'
import HorairesV2 from '@/components/dashboard/HorairesV2'
import type { Availability, Unavailability } from '@/types'

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
type Statut = 'verification' | 'pwa' | 'site'

type Props = {
  availabilities: Availability[]
  unavailabilities: Unavailability[]
  teamSize: number
  lectureIncomplete: boolean
}

export default function Horaires(props: Props) {
  const router = useRouter()
  const [statut, setStatut] = useState<Statut>('verification')

  useEffect(() => {
    setStatut(isPwaStandalone() ? 'pwa' : 'site')
  }, [])

  useEffect(() => {
    if (statut === 'site') router.replace('/dashboard/admin#disponibilites')
  }, [statut, router])

  if (statut !== 'pwa') return null

  return <HorairesV2 {...props} />
}

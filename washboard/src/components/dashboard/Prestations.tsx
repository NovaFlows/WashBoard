'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isPwaStandalone } from '@/lib/pwaStandalone'
import PrestationsV2 from '@/components/dashboard/PrestationsV2'
import type { Availability, Service, ServiceCategory, ZoneConfig } from '@/types'
import type { ReglagesCreneaux } from '@/lib/creneauxForm'

// Point d'entrée de « Prestations et prix » — destination NEUVE de la refonte
// 2026 (troisième cas de refonte.md, même schéma que Chiffres.tsx et
// MessagesAutomatiques.tsx) : côté site, les prestations se gèrent dans l'onglet
// « Prestations » de `/dashboard/admin` (`PrestationsManager`, inchangé). Cette
// route-ci n'existe dans aucun menu v1 : le site n'a jamais de raison d'y arriver.
//
// Garde-fou pour qui la tape quand même (lien copié, favori) depuis un
// navigateur classique : renvoi vers l'onglet v1 équivalent plutôt qu'un écran
// v2 — décision d'Alexandre, 2026-09-22 : v1 sur le site, v2 seulement dans la
// PWA installée, sans exception. Trois états, jamais de flash de contenu v2 côté
// site, rien pendant la vérification.
type Statut = 'verification' | 'pwa' | 'site'

type Props = {
  services: Service[]
  categories: ServiceCategory[]
  availabilities: Availability[]
  lectureIncomplete: boolean
  zone: ZoneConfig
  adresseDeBase: string | null
  creneaux: ReglagesCreneaux
}

/** Depuis le 2026-09-25, l'écran porte aussi la zone d'intervention et les
 *  créneaux intelligents : les trois ancres doivent atterrir sur la bonne carte
 *  de l'ancien onglet Identité, pas toutes sur « Prestations ». */
const ANCRES: Record<string, string> = {
  '#zone': '#zone',
  '#creneaux': '#creneaux',
}

export default function Prestations(props: Props) {
  const router = useRouter()
  const [statut, setStatut] = useState<Statut>('verification')

  useEffect(() => {
    setStatut(isPwaStandalone() ? 'pwa' : 'site')
  }, [])

  useEffect(() => {
    if (statut !== 'site') return
    const ancre = ANCRES[window.location.hash] ?? '#prestations'
    router.replace(`/dashboard/admin${ancre}`)
  }, [statut, router])

  if (statut !== 'pwa') return null

  return <PrestationsV2 {...props} />
}

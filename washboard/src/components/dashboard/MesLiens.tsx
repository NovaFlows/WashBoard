'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isPwaStandalone } from '@/lib/pwaStandalone'
import MesLiensV2 from '@/components/dashboard/MesLiensV2'

// Point d'entrée de « Mes liens » — destination NEUVE de la refonte 2026 (même schéma
// que Horaires.tsx et Prestations.tsx) : côté site, les liens par réseau se trouvent
// au bas de `/dashboard/crm` (`TrafficSourceLinks`, inchangé). Cette route-ci n'existe
// dans aucun menu v1 : le site n'a jamais de raison d'y arriver.
//
// Garde-fou pour qui la tape quand même depuis un navigateur classique : renvoi vers
// l'écran v1 équivalent — v1 sur le site, v2 seulement dans la PWA installée, sans
// exception (décision d'Alexandre, 2026-09-22). Trois états, jamais de flash de
// contenu v2 côté site, rien pendant la vérification.
type Statut = 'verification' | 'pwa' | 'site'

export default function MesLiens({ slug }: { slug: string }) {
  const router = useRouter()
  const [statut, setStatut] = useState<Statut>('verification')

  useEffect(() => {
    setStatut(isPwaStandalone() ? 'pwa' : 'site')
  }, [])

  useEffect(() => {
    if (statut === 'site') router.replace('/dashboard/crm')
  }, [statut, router])

  if (statut !== 'pwa') return null

  return <MesLiensV2 slug={slug} />
}

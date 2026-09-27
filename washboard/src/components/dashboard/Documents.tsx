'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isPwaStandalone } from '@/lib/pwaStandalone'
import DocumentsV2 from '@/components/dashboard/DocumentsV2'

// Point d'entrée de « Devis et factures » — destination NEUVE de la refonte 2026 (même schéma
// que `Depenses.tsx`). Côté site, cet écran n'existe pas encore : le laveur est renvoyé vers
// sa liste de factures, d'où il ne manque que la création à la main.
//
// Garde-fou pour qui tape l'adresse depuis un navigateur classique — v1 sur le site, v2
// seulement dans la PWA installée, sans exception (décision d'Alexandre, 2026-09-22). Trois
// états, jamais de flash de contenu v2 côté site.
type Statut = 'verification' | 'pwa' | 'site'

export default function Documents({ prestations }: { prestations: { id: string; name: string; price: number }[] }) {
  const router = useRouter()
  const [statut, setStatut] = useState<Statut>('verification')

  useEffect(() => {
    setStatut(isPwaStandalone() ? 'pwa' : 'site')
  }, [])

  useEffect(() => {
    if (statut === 'site') router.replace('/dashboard/factures')
  }, [statut, router])

  if (statut !== 'pwa') return null

  return <DocumentsV2 prestations={prestations} />
}

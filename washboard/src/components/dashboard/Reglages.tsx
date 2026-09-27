'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isPwaStandalone } from '@/lib/pwaStandalone'
import ReglagesV2 from '@/components/dashboard/ReglagesV2'

// Point d'entrée de « Réglages » — destination NEUVE de la refonte 2026 (même schéma que
// `Depenses.tsx`). Côté site, ces réglages vivent dans l'ancien formulaire complet : le
// navigateur classique y est renvoyé.
type Statut = 'verification' | 'pwa' | 'site'

export default function Reglages() {
  const router = useRouter()
  const [statut, setStatut] = useState<Statut>('verification')

  useEffect(() => {
    setStatut(isPwaStandalone() ? 'pwa' : 'site')
  }, [])

  useEffect(() => {
    if (statut === 'site') router.replace('/dashboard/parametres/tout')
  }, [statut, router])

  if (statut !== 'pwa') return null

  return <ReglagesV2 />
}

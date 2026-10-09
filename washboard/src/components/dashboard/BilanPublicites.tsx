'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isDesignMobile } from '@/lib/designMobile'
import BilanPublicitesV2, { type BilanPublicitesProps } from '@/components/dashboard/BilanPublicitesV2'

// Garde-fou PWA, même schéma que Publicites.tsx : v1 sur le site, v2 seulement
// dans l'application installée. Côté site, ces chiffres se lisent déjà dans
// l'onglet Publicités du CRM — on y renvoie plutôt que de servir un écran v2
// dans un navigateur.
type Statut = 'verification' | 'pwa' | 'site'

export default function BilanPublicites(props: BilanPublicitesProps) {
  const router = useRouter()
  const [statut, setStatut] = useState<Statut>('verification')

  useEffect(() => {
    setStatut(isDesignMobile() ? 'pwa' : 'site')
  }, [])

  useEffect(() => {
    if (statut === 'site') router.replace('/dashboard/crm?onglet=campagnes')
  }, [statut, router])

  if (statut !== 'pwa') return null

  return <BilanPublicitesV2 {...props} />
}

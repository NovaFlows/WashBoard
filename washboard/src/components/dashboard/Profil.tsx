'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isPwaStandalone } from '@/lib/pwaStandalone'
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
type Statut = 'verification' | 'pwa' | 'site'

export default function Profil(props: { washer: Washer; email: string; peutEquipe: boolean }) {
  const router = useRouter()
  const [statut, setStatut] = useState<Statut>('verification')

  useEffect(() => {
    setStatut(isPwaStandalone() ? 'pwa' : 'site')
  }, [])

  useEffect(() => {
    if (statut === 'site') router.replace('/dashboard/parametres/tout#profil')
  }, [statut, router])

  if (statut !== 'pwa') return null

  return <ProfilV2 {...props} />
}

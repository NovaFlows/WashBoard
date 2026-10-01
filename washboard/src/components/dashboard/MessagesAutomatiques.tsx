'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isPwaStandalone } from '@/lib/pwaStandalone'
import MessagesAutomatiquesV2, { type MessagesAutomatiquesProps } from '@/components/dashboard/MessagesAutomatiquesV2'

// Point d'entrée de « Messages automatiques » — destination NEUVE de la
// refonte 2026 (troisième cas de refonte.md, même schéma que Chiffres.tsx) : les
// réglages d'avis et de relance vivent, côté site, dans deux cartes du
// formulaire de réglages (`/dashboard/parametres/tout#avis` et `#relances`),
// qui ne changent pas. Cette route-ci n'existe dans aucun menu v1 : le site
// n'a jamais de raison d'y arriver.
//
// Garde-fou pour qui la tape quand même (lien copié, favori) depuis un
// navigateur classique : renvoi vers la carte v1 équivalente plutôt qu'un
// écran v2 — décision d'Alexandre, 2026-09-22 : v1 sur le site, v2 seulement
// dans la PWA installée, sans exception. Trois états, jamais de flash de
// contenu v2 côté site, rien pendant la vérification.
type Statut = 'verification' | 'pwa' | 'site'

export default function MessagesAutomatiques(props: MessagesAutomatiquesProps) {
  const router = useRouter()
  const [statut, setStatut] = useState<Statut>('verification')

  useEffect(() => {
    setStatut(isPwaStandalone() ? 'pwa' : 'site')
  }, [])

  useEffect(() => {
    if (statut === 'site') router.replace('/dashboard/parametres/tout#avis')
  }, [statut, router])

  if (statut !== 'pwa') return null

  return <MessagesAutomatiquesV2 {...props} />
}

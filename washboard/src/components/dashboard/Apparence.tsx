'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isPwaStandalone } from '@/lib/pwaStandalone'
import ApparenceV2 from '@/components/dashboard/ApparenceV2'
import type { ReglagesApparence } from '@/hooks/useApparenceV2'

// Point d'entrée de « Apparence de ma page » — destination NEUVE de la refonte 2026
// (troisième cas de refonte.md, même schéma que Horaires.tsx et Prestations.tsx) :
// côté site, le logo, la couleur, le fond, le message et le site web se règlent dans
// l'onglet « Identité » de `/dashboard/admin` (`IdentiteForm`, inchangé). Cette route-
// ci n'existe dans aucun menu v1 : le site n'a jamais de raison d'y arriver.
//
// Garde-fou pour qui la tape quand même (lien copié, favori) depuis un navigateur
// classique : renvoi vers l'onglet v1 équivalent plutôt qu'un écran v2 — décision
// d'Alexandre, 2026-09-22 : v1 sur le site, v2 seulement dans la PWA installée, sans
// exception. Trois états, jamais de flash de contenu v2 côté site, rien pendant la
// vérification.
type Statut = 'verification' | 'pwa' | 'site'

type Props = {
  nom: string
  slug: string
  initial: ReglagesApparence
}

export default function Apparence(props: Props) {
  const router = useRouter()
  const [statut, setStatut] = useState<Statut>('verification')

  useEffect(() => {
    setStatut(isPwaStandalone() ? 'pwa' : 'site')
  }, [])

  useEffect(() => {
    if (statut === 'site') router.replace('/dashboard/admin#identite')
  }, [statut, router])

  if (statut !== 'pwa') return null

  return <ApparenceV2 {...props} />
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isPwaStandalone } from '@/lib/pwaStandalone'
import PublicitesV2, { type PublicitesProps } from '@/components/dashboard/PublicitesV2'

// Point d'entrée de « Publicités » — même schéma que MessagesAutomatiques.tsx
// et Chiffres.tsx : v1 sur le site, v2 seulement dans l'application installée,
// sans exception (décision d'Alexandre, 2026-09-22).
//
// Côté site, ces chiffres existent déjà dans l'onglet Publicités du CRM. Cette
// route-ci n'apparaît dans aucun menu v1 : le site n'a jamais de raison d'y
// arriver. Pour qui la tape quand même — lien copié, favori, capture d'écran
// envoyée à un laveur — on renvoie vers l'écran v1 équivalent plutôt que de
// servir un écran v2 dans un navigateur.
//
// Trois états, et le troisième compte : pendant la vérification on ne rend
// RIEN. Rendre la v2 puis la retirer ferait clignoter un écran au mauvais
// format sur le site.
type Statut = 'verification' | 'pwa' | 'site'

export default function Publicites(props: PublicitesProps) {
  const router = useRouter()
  const [statut, setStatut] = useState<Statut>('verification')

  useEffect(() => {
    setStatut(isPwaStandalone() ? 'pwa' : 'site')
  }, [])

  useEffect(() => {
    if (statut === 'site') router.replace('/dashboard/crm?onglet=campagnes')
  }, [statut, router])

  if (statut !== 'pwa') return null

  return <PublicitesV2 {...props} />
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDashboardV2 } from '@/hooks/useDashboardV2'
import PublicitesV2, { type PublicitesProps } from '@/components/dashboard/PublicitesV2'

// Point d'entrée de « Publicités » — même schéma que MessagesAutomatiques.tsx
// et Chiffres.tsx : v1 sur le site étroit, v2 dans l'application installée ET,
// depuis la passe « bureau » (2026-10-06), sur le site en grand écran derrière
// `washer.beta_refonte` (`useDashboardV2()`, remplace l'ancien `isPwaStandalone()`
// nu — décision d'Alexandre, 2026-09-22, toujours en vigueur pour le site étroit).
//
// Côté site étroit, ces chiffres existent déjà dans l'onglet Publicités du CRM.
// Cette route-ci n'apparaît dans aucun menu v1 : un navigateur étroit n'a jamais
// de raison d'y arriver de lui-même. Pour qui la tape quand même — lien copié,
// favori, capture d'écran envoyée à un laveur — on renvoie vers l'écran v1
// équivalent plutôt que de servir un écran v2 dans ce cas-là.
//
// Pendant la vérification on ne rend RIEN. Rendre la v2 puis la retirer
// ferait clignoter un écran au mauvais format sur le site.
//
// `estV2` est déjà réactif (`useSyncExternalStore`, voir useDashboardV2.ts) : seul `verifie`
// reste un état, pour ne rediriger qu'une fois le premier rendu client passé.
export default function Publicites({ betaRefonte, ...props }: PublicitesProps & {
  /** `washer.beta_refonte` — voir `useDashboardV2.ts`. */
  betaRefonte?: boolean | null
}) {
  const router = useRouter()
  const estV2 = useDashboardV2(betaRefonte)
  const [verifie, setVerifie] = useState(false)

  useEffect(() => { setVerifie(true) }, [])

  useEffect(() => {
    if (verifie && !estV2) router.replace('/dashboard/crm?onglet=campagnes')
  }, [verifie, estV2, router])

  if (!verifie || !estV2) return null

  return <PublicitesV2 {...props} />
}

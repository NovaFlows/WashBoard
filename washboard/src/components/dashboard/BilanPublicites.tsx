'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDashboardV2 } from '@/hooks/useDashboardV2'
import BilanPublicitesV2, { type BilanPublicitesProps } from '@/components/dashboard/BilanPublicitesV2'

// Garde-fou, même schéma que Publicites.tsx : v1 sur le site étroit, v2 dans
// l'application installée ET, depuis la passe « bureau » (2026-10-06), sur le
// site en grand écran derrière `washer.beta_refonte` (`useDashboardV2()`).
// Côté site étroit, ces chiffres se lisent déjà dans l'onglet Publicités du
// CRM — on y renvoie plutôt que de servir un écran v2 dans ce cas-là.
//
// `estV2` est déjà réactif (`useSyncExternalStore`, voir useDashboardV2.ts) : seul `verifie`
// reste un état, pour ne rediriger qu'une fois le premier rendu client passé.
export default function BilanPublicites({ betaRefonte, ...props }: BilanPublicitesProps & {
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

  return <BilanPublicitesV2 {...props} />
}

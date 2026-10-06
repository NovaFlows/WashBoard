'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDashboardV2 } from '@/hooks/useDashboardV2'
import MessagesAutomatiquesV2, { type MessagesAutomatiquesProps } from '@/components/dashboard/MessagesAutomatiquesV2'

// Point d'entrée de « Messages automatiques » — destination NEUVE de la
// refonte 2026 (troisième cas de refonte.md, même schéma que Chiffres.tsx) : les
// réglages d'avis et de relance vivent, côté site étroit, dans deux cartes du
// formulaire de réglages (`/dashboard/parametres/tout#avis` et `#relances`),
// qui ne changent pas. Cette route-ci n'existe dans aucun menu v1 : le site
// n'a jamais de raison d'y arriver de lui-même.
//
// Passe « bureau » (2026-10-06) : `isPwaStandalone()` nu devient `useDashboardV2()`, le même
// point de décision que ClientsView.tsx — v2 pour la PWA installée (toute largeur) ET pour le
// site sur grand écran derrière `washer.beta_refonte` (voir useDashboardV2.ts). Un navigateur
// classique étroit, lui, continue d'être renvoyé vers la carte v1 — décision d'Alexandre,
// 2026-09-22, jamais rouverte pour CE cas : v1 sur le site étroit, sans exception.
//
// `estV2` vient déjà d'un hook réactif (`useSyncExternalStore`, voir useDashboardV2.ts) : pas
// besoin de le recopier dans un état local à chaque changement (ce que faisait l'ancienne
// version avec `isPwaStandalone()` nu) — seul `verifie` reste un état, pour ne déclencher la
// redirection qu'une fois le premier rendu client passé (jamais pendant le rendu serveur, où
// `estV2` vaut toujours faux).
export default function MessagesAutomatiques({ betaRefonte, ...props }: MessagesAutomatiquesProps & {
  /** `washer.beta_refonte` — garde-fou temporaire du cas « site, grand écran » (voir
   *  `useDashboardV2.ts`). Sans effet dans la PWA, où v2 s'affiche sans condition. */
  betaRefonte?: boolean | null
}) {
  const router = useRouter()
  const estV2 = useDashboardV2(betaRefonte)
  const [verifie, setVerifie] = useState(false)

  useEffect(() => { setVerifie(true) }, [])

  useEffect(() => {
    if (verifie && !estV2) router.replace('/dashboard/parametres/tout#avis')
  }, [verifie, estV2, router])

  // Rien avant la vérification (évite un flash de contenu v2 dans un
  // navigateur classique), rien non plus pendant la redirection.
  if (!verifie || !estV2) return null

  return <MessagesAutomatiquesV2 {...props} />
}

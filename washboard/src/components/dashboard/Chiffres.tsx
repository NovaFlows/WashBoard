'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isDesignMobile } from '@/lib/designMobile'
import { estEcranRail } from '@/lib/grandEcran'
import { bureauForceEnDev } from '@/hooks/useDashboardV2'
import ChiffresV2, { type ChiffresProps } from '@/components/dashboard/ChiffresV2'

// Point d'entrée de « Chiffres » — nouvelle destination de la refonte 2026
// (passe 5) qui fusionne l'ancien CRM et la Comptabilité en un seul écran à
// 3 onglets (Argent · Acquisition · Clients). Contrairement à ClientsView.tsx
// ou ClientProfileModal.tsx (mêmes URLs qu'avant, contenu qui bascule entre
// V1 et V2), cette route est ENTIÈREMENT NEUVE : elle n'existe dans aucun
// menu v1, donc il n'y a rien à « brancher » — le site (navigateur classique)
// n'a jamais de raison d'y arriver. Ce composant est le garde-fou qui le
// vérifie quand même : si quelqu'un tape /dashboard/chiffres depuis un
// navigateur classique (lien copié, favori...), on le renvoie vers l'écran
// CRM existant plutôt que de lui montrer un écran v2 — décision d'Alexandre,
// 2026-09-22 : v1 sur le site, v2 seulement dans la PWA installée, sans
// exception.
//
// REOUVERT le 2026-10-06 (passe « Chiffres bureau ») pour le cas SITE + grand écran, comme
// `useDashboardV2.ts` : un laveur qui ouvre le site (pas la PWA) sur un écran assez large, avec
// `washer.beta_refonte` actif, voit lui aussi ce même écran plutôt que d'être renvoyé vers
// `/dashboard/crm`. Pas d'appel à `useDashboardV2()` lui-même ici : ce hook est réactif (il
// change si on redimensionne la fenêtre), alors que cette décision ne doit être prise QU'UNE
// FOIS, au montage — exactement le risque que ce composant évitait déjà avant cette passe (voir
// le paragraphe suivant). Redimensionner sous le seuil une fois l'écran ouvert ne doit pas faire
// sauter le laveur vers `/dashboard/crm` en pleine lecture de ses chiffres.
//
// Pas de classe CSS ici : ni `isPwaStandalone()` ni `estEcranRail()` ne peuvent être lus avant
// le montage (aucun équivalent "cookie lu côté serveur" pour `display-mode` ou la largeur de
// fenêtre), et il faut distinguer « pas encore vérifié » de « vérifié, ce n'est ni la PWA ni le
// site en bureau » pour ne rediriger qu'une fois la certitude acquise — d'où cet état à trois
// valeurs plutôt qu'un simple booléen.
type Statut = 'verification' | 'v2' | 'v1'

type Props = ChiffresProps & {
  /** `washer.beta_refonte` — garde-fou temporaire du cas « site, grand écran » (voir
   *  `useDashboardV2.ts`). Sans effet dans la PWA, où cet écran s'affiche déjà sans condition,
   *  largeur quelconque. */
  betaRefonte?: boolean | null
}

export default function Chiffres({ betaRefonte, ...props }: Props) {
  const router = useRouter()
  const [statut, setStatut] = useState<Statut>('verification')

  useEffect(() => {
    const pwa = isDesignMobile()
    const bureau = estEcranRail() && (!!betaRefonte || bureauForceEnDev())
    setStatut(pwa || bureau ? 'v2' : 'v1')
    // Décidé une seule fois, au montage (voir le commentaire plus haut) : `betaRefonte` est une
    // prop stable pour la durée de vie de la page (venue du serveur), pas une raison de
    // recalculer plus tard.
  }, [betaRefonte])

  useEffect(() => {
    if (statut === 'v1') router.replace('/dashboard/crm')
  }, [statut, router])

  // Rien pendant la vérification (évite un flash de contenu v2 dans un
  // navigateur classique), rien non plus pendant la redirection.
  if (statut !== 'v2') return null

  return <ChiffresV2 {...props} />
}

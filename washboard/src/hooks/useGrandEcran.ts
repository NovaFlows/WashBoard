'use client'

import { useSyncExternalStore } from 'react'
import { estGrandEcran, sAbonnerGrandEcran } from '@/lib/grandEcran'

// À utiliser pour une décision de MISE EN PAGE (pas de FORME de composant isolé) qui dépend de
// la largeur réelle de la fenêtre — ex. la liste Clients qui montre la fiche à côté plutôt que
// par-dessus (ClientsViewV2.tsx, passe bureau du 2026-10-05). Le serveur rend toujours « petit
// écran » (`false`) : la vraie largeur n'est connue qu'une fois dans le navigateur, et peut
// changer en cours de session (redimensionner une fenêtre, diviser l'écran) — d'où un vrai
// abonnement (`sAbonnerGrandEcran`), contrairement à `usePwaStandalone`, qui n'en a pas besoin.
export function useGrandEcran(): boolean {
  return useSyncExternalStore(sAbonnerGrandEcran, estGrandEcran, () => false)
}

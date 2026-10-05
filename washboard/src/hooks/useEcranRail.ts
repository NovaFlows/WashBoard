'use client'

import { useSyncExternalStore } from 'react'
import { estEcranRail, sAbonnerEcranRail } from '@/lib/grandEcran'

// « Cet appareil a-t-il la place ET le type d'entrée pour le rail vertical ? » — voir
// `grandEcran.ts` pour pourquoi ce n'est pas la même question que `useGrandEcran()`.
// Le serveur rend toujours `false` : la vraie réponse n'existe que dans le navigateur.
export function useEcranRail(): boolean {
  return useSyncExternalStore(sAbonnerEcranRail, estEcranRail, () => false)
}

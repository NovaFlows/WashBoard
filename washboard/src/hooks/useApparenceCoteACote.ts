'use client'

import { useSyncExternalStore } from 'react'
import { estApparenceCoteACote, sAbonnerApparenceCoteACote } from '@/lib/grandEcran'

// « La fenêtre est-elle assez large pour que réglages et aperçu tiennent côte à côte DANS
// l'écran "Apparence de ma page" ? » — voir `grandEcran.ts` (`SEUIL_APPARENCE_COTE_A_COTE_PX`)
// pour pourquoi ce n'est pas la même question que `useGrandEcran()`. Le serveur rend toujours
// `false` : la vraie réponse n'existe que dans le navigateur.
export function useApparenceCoteACote(): boolean {
  return useSyncExternalStore(sAbonnerApparenceCoteACote, estApparenceCoteACote, () => false)
}

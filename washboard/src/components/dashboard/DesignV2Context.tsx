'use client'

import { createContext, useContext } from 'react'
import { useDesignMobile } from '@/hooks/useDesignMobile'

// « Cette page est-elle dans la nouvelle version (v2) ? » — décidé UNE fois par DashboardShell
// (`useDashboardV2` : téléphone, ou ordinateur avec `beta_refonte`) et redistribué aux morceaux
// partagés entre l'ancien site et la v2 (carte de démarrage, barre de configuration, en-tête de
// Plus…).
//
// Avant (audit du 2026-10-10), ces morceaux se demandaient seulement « est-ce un téléphone ? »
// (`useDesignMobile`) : sur la v2 ordinateur, ils répondaient « non » et retombaient sur les
// liens et les couleurs de l'ancien site. Hors du châssis (aucun fournisseur), on garde l'ancienne
// réponse.
export const DesignV2Context = createContext<boolean | null>(null)

export function useDesignV2(): boolean {
  const fourni = useContext(DesignV2Context)
  const mobile = useDesignMobile()
  return fourni ?? mobile
}

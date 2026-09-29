'use client'

import { createContext, useContext } from 'react'
import type { Feature, Plan } from '@/lib/plan'

// L'offre en vigueur, calculée UNE fois par DashboardShell (planEffectif) et
// redistribuée aux écrans de la PWA. Les écrans v2 sont des composants clients
// dont les pages n'ont pas toutes de raison de transmettre le plan : le
// contexte évite de rajouter une prop à chacun. Hors du châssis (aucun
// fournisseur), tout est permis — jamais un verrou posé par erreur ; le
// serveur reste de toute façon la seule autorité (voir `refuserOffre`).

export type OffreCourante = {
  offre: Plan | null
  peut: (feature: Feature) => boolean
}

export const OffreContext = createContext<OffreCourante>({ offre: null, peut: () => true })

export function useOffre(): OffreCourante {
  return useContext(OffreContext)
}

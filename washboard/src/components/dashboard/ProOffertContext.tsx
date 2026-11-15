'use client'

import { createContext, useContext } from 'react'

// Fin du Pro offert par parrainage, lue une fois par le layout du tableau de bord : les pages
// passent l'offre à DashboardShell sans cette date, qui doit pourtant compter dans `planEffectif`.
const ProOffertContext = createContext<string | null>(null)

export function ProOffertFourni({ jusquAu, children }: { jusquAu: string | null; children: React.ReactNode }) {
  return <ProOffertContext.Provider value={jusquAu}>{children}</ProOffertContext.Provider>
}

export function useProOffert(): string | null {
  return useContext(ProOffertContext)
}

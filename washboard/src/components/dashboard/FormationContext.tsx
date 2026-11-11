'use client'

import { createContext, useContext } from 'react'

// L'onglet « Formation » est-il ouvert pour ce compte ? Calculé côté serveur (layout du
// tableau de bord, `formationOuverte`), lu par le rail de gauche. Faux par défaut.
const FormationContext = createContext(false)

export function FormationProvider({ ouverte, children }: { ouverte: boolean; children: React.ReactNode }) {
  return <FormationContext.Provider value={ouverte}>{children}</FormationContext.Provider>
}

export function useFormationOuverte(): boolean {
  return useContext(FormationContext)
}

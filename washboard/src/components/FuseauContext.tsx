'use client'

// Fuseau du laveur connecté, pour les écrans du tableau de bord (lib/fuseaux.ts).
//
// Posé une fois par la mise en page du tableau de bord, lu par `useFuseau()`.
// Sans fournisseur — page publique, démo, test — la valeur est Paris : le
// comportement d'avant, à l'identique.

import { createContext, useContext } from 'react'
import { FUSEAU } from '@/lib/dateUtils'

const ContexteFuseau = createContext<string>(FUSEAU)

export function FuseauProvider({ fuseau, children }: { fuseau: string; children: React.ReactNode }) {
  return <ContexteFuseau.Provider value={fuseau}>{children}</ContexteFuseau.Provider>
}

/** Fuseau dans lequel afficher et saisir les heures des rendez-vous. */
export function useFuseau(): string {
  return useContext(ContexteFuseau)
}

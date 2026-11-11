'use client'

import { useCallback, useEffect, useState } from 'react'

// Leçons terminées par le laveur (branche feat/formation, 2026-11-10).
//
// COQUILLE : la progression vit dans le navigateur (`localStorage`), faute de table. Elle ne suit
// donc pas le laveur d'un appareil à l'autre. À remplacer par la table `formation_progression`
// (voir docs/FORMATION.md) — la signature du hook ne devrait pas changer.

const CLE = 'wb-formation-termines'

function lire(): string[] {
  try {
    const brut = window.localStorage.getItem(CLE)
    const liste = brut ? JSON.parse(brut) : []
    return Array.isArray(liste) ? liste.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function useProgressionFormation() {
  const [termines, setTermines] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lu au montage : le stockage n'existe pas au rendu serveur
    setTermines(new Set(lire()))
  }, [])

  const marquer = useCallback((leconId: string, fait: boolean) => {
    setTermines(avant => {
      const suivant = new Set(avant)
      if (fait) suivant.add(leconId); else suivant.delete(leconId)
      try { window.localStorage.setItem(CLE, JSON.stringify([...suivant])) } catch { /* navigation privée : on garde l'état en mémoire */ }
      return suivant
    })
  }, [])

  return { termines, marquer }
}

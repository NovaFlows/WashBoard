'use client'

import { useMemo, useState } from 'react'
import type { Availability } from '@/types'
import { ajouterPlages, retirerPlage } from '@/lib/horairesApi'
import { unSeulALaFois, type ResultatJour } from '@/lib/horaires'

// État de l'écran « Horaires » de la PWA (`HorairesV2`) : les plages affichées et
// leurs deux écritures. La liste locale ne change QU'APRÈS un succès du serveur :
// une plage qui semble retirée et qui ne l'est pas, c'est un créneau qu'on croit
// avoir fermé et que les clients continuent de réserver.
//
// `ajouter` rend un résultat PAR JOUR (`null` si un appel était déjà en cours :
// le second tap est ignoré). Les jours créés entrent dans la liste même quand
// d'autres ont échoué — c'est ce qui est réellement enregistré.
//
// Mêmes routes, mêmes corps que `DisponibilitesManager` (le site).

export function useHorairesV2(plagesInitiales: Availability[]) {
  const [plages, setPlages] = useState(plagesInitiales)

  // Créé une seule fois : le verrou doit survivre aux rendus. L'action n'utilise
  // que `setPlages` (stable) et des fonctions de module.
  const ajouter = useMemo(
    () => unSeulALaFois(async (jours: number[], debut: string, fin: string): Promise<ResultatJour[]> => {
      const resultats = await ajouterPlages(jours, debut, fin)
      const creees = resultats.flatMap(r => (r.ok ? [r.plage] : []))
      if (creees.length > 0) setPlages(p => [...p, ...creees])
      return resultats
    }),
    [],
  )

  /** `null` si la plage est retirée, sinon la phrase d'erreur. */
  async function retirer(id: string): Promise<string | null> {
    const r = await retirerPlage(id)
    if (!r.ok) return r.message
    setPlages(p => p.filter(x => x.id !== id))
    return null
  }

  return { plages, ajouter, retirer }
}

// Appels de l'écran « Horaires » de la PWA aux routes `/api/availabilities` — les
// mêmes que celles du site (`DisponibilitesManager`), avec le même corps. Le
// contrat d'appel et la traduction des échecs sont ceux de `prestationsApi`
// (`appeler`) : une phrase claire du serveur pour un refus, une simple référence
// pour une panne.
//
// Il n'existe pas de route de modification : changer une plage, c'est la retirer
// puis en créer une autre (comme sur le site).
//
// Ajouter la même plage à plusieurs jours = un POST par jour. Ces appels ne sont
// PAS atomiques : la route est partagée avec le site et ne connaît qu'une plage à
// la fois. `ajouterPlages` rend donc un résultat par jour, jamais un seul
// verdict — l'écran dit ce qui a été créé et ce qui a échoué.

import type { Availability } from '@/types'
import { appeler, avecLigne, type ResultatApi } from '@/lib/prestationsApi'
import { trierJours, type ResultatJour } from '@/lib/horaires'

export async function creerPlage(jour: number, debut: string, fin: string): Promise<ResultatApi<Availability>> {
  return avecLigne<Availability>(
    await appeler('enregistrer', 'POST', '/api/availabilities', { day_of_week: jour, start_time: debut, end_time: fin }),
  )
}

export async function retirerPlage(id: string): Promise<ResultatApi<null>> {
  const r = await appeler('supprimer', 'DELETE', `/api/availabilities/${id}`)
  return r.ok ? { ok: true, data: null } : r
}

/** Une plage sur chaque jour, lundi d'abord, l'un après l'autre. Un échec n'arrête
 *  pas les suivants : chaque jour est indépendant, et l'écran retente seulement
 *  ceux qui ont échoué. */
export async function ajouterPlages(jours: number[], debut: string, fin: string): Promise<ResultatJour[]> {
  const resultats: ResultatJour[] = []
  for (const jour of trierJours(jours)) {
    const r = await creerPlage(jour, debut, fin)
    resultats.push(r.ok ? { jour, ok: true, plage: r.data } : { jour, ok: false, message: r.message })
  }
  return resultats
}

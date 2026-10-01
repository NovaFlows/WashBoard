// Appels de l'écran « Dépenses » (PWA) aux routes `/api/expenses*` — les mêmes que l'ancien
// écran de comptabilité, avec les mêmes corps. Le contrat d'erreur est celui de
// `prestationsApi` : une phrase claire du serveur pour un refus, une simple référence
// (`errorId`) pour une panne, jamais « Failed to fetch ».

import { appeler, type ResultatApi } from '@/lib/prestationsApi'
import type { Depense, DepenseRecurrente } from '@/lib/depenses'

const PHRASE_RESEAU = 'Chargement impossible. Vérifiez votre connexion et réessayez.'

/** Les frais de la période. Une panne n'efface rien à l'écran : l'appelant garde ce qu'il
 *  affichait et montre la phrase. */
export async function lireDepenses(debut: string, fin: string): Promise<ResultatApi<Depense[]>> {
  let res: Response
  try {
    res = await fetch(`/api/expenses?start=${encodeURIComponent(debut)}&end=${encodeURIComponent(fin)}`)
  } catch {
    return { ok: false, message: PHRASE_RESEAU }
  }
  if (!res.ok) return { ok: false, message: 'Vos frais n’ont pas pu être chargés. Réessayez.' }
  const json = await res.json().catch(() => null) as { expenses?: Depense[] } | null
  return { ok: true, data: json?.expenses ?? [] }
}

export async function lireRecurrents(): Promise<ResultatApi<DepenseRecurrente[]>> {
  let res: Response
  try {
    res = await fetch('/api/expenses/recurring')
  } catch {
    return { ok: false, message: PHRASE_RESEAU }
  }
  if (!res.ok) return { ok: false, message: 'Vos frais récurrents n’ont pas pu être chargés. Réessayez.' }
  const json = await res.json().catch(() => null) as { recurring?: DepenseRecurrente[] } | null
  return { ok: true, data: json?.recurring ?? [] }
}

export async function ajouterDepense(champs: { date: string; category: string; label: string; amount: number }): Promise<ResultatApi<null>> {
  const r = await appeler('enregistrer', 'POST', '/api/expenses', champs)
  return r.ok ? { ok: true, data: null } : r
}

export async function supprimerDepense(id: string): Promise<ResultatApi<null>> {
  const r = await appeler('supprimer', 'DELETE', `/api/expenses/${id}`)
  return r.ok ? { ok: true, data: null } : r
}

export async function ajouterRecurrent(champs: { category: string; label: string; amount: number; day_of_month: number }): Promise<ResultatApi<null>> {
  const r = await appeler('enregistrer', 'POST', '/api/expenses/recurring', champs)
  return r.ok ? { ok: true, data: null } : r
}

export async function basculerRecurrent(id: string, active: boolean): Promise<ResultatApi<null>> {
  const r = await appeler('enregistrer', 'PATCH', `/api/expenses/recurring/${id}`, { active })
  return r.ok ? { ok: true, data: null } : r
}

export async function supprimerRecurrent(id: string): Promise<ResultatApi<null>> {
  const r = await appeler('supprimer', 'DELETE', `/api/expenses/recurring/${id}`)
  return r.ok ? { ok: true, data: null } : r
}

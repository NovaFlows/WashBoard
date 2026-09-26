// Appels de l'écran « Prestations et prix » de la PWA aux routes `/api/services`
// et `/api/categories` — les mêmes que celles du site (`PrestationsManager`,
// `CategoriesManager`), avec les mêmes corps. Ici, seulement le contrat d'appel
// et la traduction des échecs en une phrase que le laveur comprend ; les
// validations (un type au moins, durée entre 1 et 480 min) restent côté serveur.
//
// Même principe que `enregistrerReglages` : un refus explicite (4xx) porte déjà
// une phrase claire du serveur (« Cochez au moins un type… », « Impossible de
// supprimer… : des réservations l'utilisent ») ; une panne (5xx) n'en a pas, on
// n'affiche pas son texte technique — seulement sa référence, pour qu'on puisse
// la retrouver dans les journaux (`docs/RUNBOOK.md`).

import type { CategoryType, Service, ServiceCategory } from '@/types'
import { corpsPrestation, type FormulairePrestation } from '@/lib/prestationForm'

export type ResultatApi<T> = { ok: true; data: T } | { ok: false; message: string }

export type Action = 'enregistrer' | 'supprimer' | 'envoyer'

const RESEAU: Record<Action, string> = {
  enregistrer: 'Enregistrement impossible. Vérifiez votre connexion et réessayez.',
  supprimer: 'Suppression impossible. Vérifiez votre connexion et réessayez.',
  envoyer: 'Envoi impossible. Vérifiez votre connexion et réessayez.',
}
const SERVEUR: Record<Action, string> = {
  enregistrer: 'Enregistrement impossible. Réessayez dans un instant.',
  supprimer: 'Suppression impossible. Réessayez dans un instant.',
  envoyer: 'Envoi impossible. Réessayez dans un instant.',
}

export const phraseReseau = (action: Action): string => RESEAU[action]

/** Traduit la réponse d'un échec en une phrase (voir l'en-tête du fichier). Partagée
 *  avec les envois d'image de l'écran Apparence (`apparenceApi`), qui n'ont pas le
 *  même format de succès mais le même contrat d'erreur. */
export function echecDepuisReponse(
  action: Action, status: number, json: { error?: unknown; errorId?: unknown },
): { ok: false; message: string } {
  if (status === 401) return { ok: false, message: 'Votre session a expiré. Reconnectez-vous.' }
  if (status >= 400 && status < 500 && typeof json.error === 'string' && json.error.trim()) {
    return { ok: false, message: json.error }
  }
  const ref = typeof json.errorId === 'string' && json.errorId ? ` (réf. ${json.errorId.slice(0, 8)})` : ''
  return { ok: false, message: SERVEUR[action] + ref }
}

export async function appeler(action: Action, method: string, url: string, corps?: unknown): Promise<ResultatApi<unknown>> {
  let res: Response
  try {
    res = await fetch(url, {
      method,
      ...(corps === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) }),
    })
  } catch {
    return { ok: false, message: RESEAU[action] }
  }

  let json: { data?: unknown; error?: unknown; errorId?: unknown } = {}
  try {
    json = await res.json()
  } catch {
    // corps illisible : on décide d'après le statut seul
  }

  if (res.ok) return { ok: true, data: json.data }
  return echecDepuisReponse(action, res.status, json)
}

/** Une création qui répond « ok » sans la ligne créée est traitée comme un
 *  échec : l'écran n'aurait rien à afficher, et on ne veut pas de doublon si le
 *  laveur retente. */
export function avecLigne<T extends { id: string }>(r: ResultatApi<unknown>): ResultatApi<T> {
  if (!r.ok) return r
  const ligne = r.data as { id?: unknown } | undefined
  if (!ligne || typeof ligne.id !== 'string') {
    return { ok: false, message: 'La réponse du serveur est incomplète. Rechargez la page pour vérifier avant de réessayer.' }
  }
  return { ok: true, data: ligne as T }
}

const sansDonnee = (r: ResultatApi<unknown>): ResultatApi<null> => (r.ok ? { ok: true, data: null } : r)

export async function creerPrestation(form: FormulairePrestation): Promise<ResultatApi<Service>> {
  return avecLigne<Service>(await appeler('enregistrer', 'POST', '/api/services', corpsPrestation(form)))
}

export async function modifierPrestation(id: string, form: FormulairePrestation): Promise<ResultatApi<null>> {
  return sansDonnee(await appeler('enregistrer', 'PATCH', `/api/services/${id}`, corpsPrestation(form)))
}

export async function supprimerPrestation(id: string): Promise<ResultatApi<null>> {
  return sansDonnee(await appeler('supprimer', 'DELETE', `/api/services/${id}`))
}

export async function creerCategorie(name: string, types: CategoryType[], displayOrder: number): Promise<ResultatApi<ServiceCategory>> {
  return avecLigne<ServiceCategory>(
    await appeler('enregistrer', 'POST', '/api/categories', { name, types, display_order: displayOrder }),
  )
}

export async function modifierCategorie(id: string, name: string, types: CategoryType[]): Promise<ResultatApi<null>> {
  return sansDonnee(await appeler('enregistrer', 'PATCH', `/api/categories/${id}`, { name, types }))
}

export async function supprimerCategorie(id: string): Promise<ResultatApi<null>> {
  return sansDonnee(await appeler('supprimer', 'DELETE', `/api/categories/${id}`))
}

// Appels de l'écran « Apparence de ma page » de la PWA aux routes `/api/washer`,
// `/api/washer/logo` et `/api/washer/background` — les mêmes que celles de l'ancien
// écran (`IdentiteForm`), avec les mêmes corps. Le contrat d'erreur est celui de
// `prestationsApi` : une phrase claire du serveur pour un refus, une simple
// référence (`errorId`) pour une panne, jamais « Failed to fetch ».

import { appeler, echecDepuisReponse, phraseReseau, type ResultatApi } from '@/lib/prestationsApi'

export type ChampsApparence = Partial<{
  logo_url: string | null
  brand_color: string
  background_theme: string | null
  welcome_message: string | null
  website_url: string | null
}>

/** Écrit un ou plusieurs champs de la fiche (`PATCH /api/washer`). La route est
 *  partagée avec le site : on n'envoie QUE les champs modifiés. */
export async function enregistrerApparence(champs: ChampsApparence): Promise<ResultatApi<null>> {
  const r = await appeler('enregistrer', 'PATCH', '/api/washer', champs)
  return r.ok ? { ok: true, data: null } : r
}

/** Refus 413 : le fichier dépasse le plafond serveur (logo 500 Ko, fond 1,5 Mo)
 *  même après la réduction faite dans le navigateur. */
export const PHRASE_IMAGE_TROP_LOURDE = 'Cette image est trop lourde, même réduite. Essayez-en une plus petite.'

/** Envoie l'image déjà réduite (`compressImage`) et rend l'adresse publique du
 *  fichier. Les routes écrivent aussi `logo_url` / `background_theme` en base :
 *  aucun second appel n'est nécessaire. */
export async function envoyerImage(cible: 'logo' | 'background', fichier: File): Promise<ResultatApi<string>> {
  const form = new FormData()
  form.append('file', fichier, fichier.name)

  let res: Response
  try {
    res = await fetch(`/api/washer/${cible}`, { method: 'POST', body: form })
  } catch {
    return { ok: false, message: phraseReseau('envoyer') }
  }

  let json: { url?: unknown; error?: unknown; errorId?: unknown } = {}
  try {
    json = await res.json()
  } catch {
    // corps illisible : on décide d'après le statut seul
  }

  if (res.ok) {
    if (typeof json.url === 'string' && json.url) return { ok: true, data: json.url }
    return { ok: false, message: 'La réponse du serveur est incomplète. Rechargez la page pour vérifier avant de réessayer.' }
  }
  if (res.status === 413) return { ok: false, message: PHRASE_IMAGE_TROP_LOURDE }
  return echecDepuisReponse('envoyer', res.status, json)
}

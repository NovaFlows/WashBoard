// Enregistrement des deux feuilles « Où vous intervenez » et « Créneaux
// intelligents » de la PWA : un SEUL `PATCH /api/washer` par feuille — la route
// est partagée avec le site, on n'envoie que les champs de la feuille, et
// plusieurs champs doivent être valides ensemble (un rayon sans adresse, une
// remise sans son type n'ont pas de sens).
//
// La phrase d'échec diffère de celle des autres écrans à dessein : ici la feuille
// RESTE OUVERTE avec la saisie du laveur, il doit savoir que rien n'est parti et
// qu'il peut réessayer sans risquer un double enregistrement. La référence de
// l'erreur (`errorId`) suit la même convention que `prestationsApi` — huit
// caractères, retrouvables dans `docs/RUNBOOK.md`.

import type { ResultatApi } from '@/lib/prestationsApi'

export const ECHEC_RESEAU = 'Rien n’a été enregistré. Vérifiez votre connexion et réessayez.'
export const ECHEC_SERVEUR = 'Rien n’a été enregistré. Réessayez.'
export const ECHEC_SESSION = 'Votre session a expiré. Reconnectez-vous.'

export async function enregistrerZoneCreneaux(champs: Record<string, unknown>): Promise<ResultatApi<null>> {
  let res: Response
  try {
    res = await fetch('/api/washer', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(champs),
    })
  } catch {
    return { ok: false, message: ECHEC_RESEAU }
  }

  if (res.ok) return { ok: true, data: null }

  let json: { error?: unknown; errorId?: unknown } = {}
  try {
    json = await res.json()
  } catch {
    // corps illisible : on décide d'après le statut seul
  }

  if (res.status === 401) return { ok: false, message: ECHEC_SESSION }
  // Un refus explicite (4xx) porte déjà une phrase claire du serveur ; une panne
  // (5xx) n'en a pas — on n'affiche jamais son texte technique.
  if (res.status < 500 && typeof json.error === 'string' && json.error.trim()) {
    return { ok: false, message: json.error }
  }
  const ref = typeof json.errorId === 'string' && json.errorId ? ` (réf. ${json.errorId.slice(0, 8)})` : ''
  return { ok: false, message: ECHEC_SERVEUR + ref }
}

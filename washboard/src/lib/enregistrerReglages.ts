// Écriture d'un ou plusieurs réglages du laveur par `PATCH /api/washer` — la
// route que le formulaire v1, « Personnaliser » et les Messages automatiques
// utilisent tous. Ici, seulement le contrat d'appel et la traduction des échecs
// en une phrase que le laveur comprend ; les validations restent côté serveur
// (plan Pro, bornes des délais) et ne sont pas dupliquées.

export type ResultatEnregistrement = { ok: true } | { ok: false; message: string }

const MESSAGE_RESEAU = 'Enregistrement impossible. Vérifiez votre connexion et réessayez.'
const MESSAGE_SERVEUR = 'Enregistrement impossible. Réessayez dans un instant.'

export async function enregistrerReglages(champs: Record<string, unknown>): Promise<ResultatEnregistrement> {
  let res: Response
  try {
    res = await fetch('/api/washer', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(champs),
    })
  } catch {
    return { ok: false, message: MESSAGE_RESEAU }
  }
  if (res.ok) return { ok: true }
  if (res.status === 401) return { ok: false, message: 'Votre session a expiré. Reconnectez-vous.' }
  // Un refus explicite (403 « réservé au plan Pro », 400 valeur invalide) porte
  // déjà une phrase claire ; une panne (5xx) n'en a pas, on n'affiche pas son
  // texte technique.
  if (res.status >= 400 && res.status < 500) {
    try {
      const corps = await res.json() as { error?: unknown }
      if (typeof corps.error === 'string' && corps.error.trim()) return { ok: false, message: corps.error }
    } catch {
      // corps illisible : message générique ci-dessous
    }
  }
  return { ok: false, message: MESSAGE_SERVEUR }
}

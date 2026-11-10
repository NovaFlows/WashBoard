// Appels du navigateur pour changer de numéro (2026-11-10) : partagés par la feuille « Téléphone » de
// Mon profil (PWA) et par l'ancien formulaire du site. La route : `POST /api/washer/telephone`.

export type Resultat<T> = ({ ok: true } & T) | { ok: false; message: string; attente?: number }

async function appeler<T>(corps: Record<string, unknown>): Promise<Resultat<T>> {
  try {
    const res = await fetch('/api/washer/telephone', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) })
    const r = await res.json().catch(() => ({}))
    if (res.ok) return { ok: true, ...r }
    return { ok: false, message: r.error ?? 'Changement impossible. Réessayez.', attente: typeof r.retryAfter === 'number' ? r.retryAfter : undefined }
  } catch {
    return { ok: false, message: 'Changement impossible. Vérifiez votre connexion.' }
  }
}

/** Envoie un code par SMS au nouveau numéro. `telephone` : le numéro masqué, pour l'afficher. */
export const demanderCodeTelephone = (telephone: string, motDePasse: string) =>
  appeler<{ telephone: string }>({ etape: 'code', telephone, motDePasse })

/** Valide le code : le numéro change. `telephone` : le nouveau numéro, tel qu'enregistré. */
export const confirmerCodeTelephone = (code: string) => appeler<{ telephone: string }>({ etape: 'confirmer', code })

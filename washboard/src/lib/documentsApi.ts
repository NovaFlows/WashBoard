// Appels de l'écran « Devis et factures » (PWA) aux routes `/api/documents*`. Même contrat
// d'erreur que `prestationsApi` : une phrase claire du serveur pour un refus, une simple
// référence (`errorId`) pour une panne, jamais « Failed to fetch ».

import { appeler, type ResultatApi } from '@/lib/prestationsApi'
import type { Document, SaisieDocument } from '@/lib/documents'

const PHRASE_RESEAU = 'Chargement impossible. Vérifiez votre connexion et réessayez.'

export async function lireDocuments(): Promise<ResultatApi<Document[]>> {
  let res: Response
  try {
    res = await fetch('/api/documents')
  } catch {
    return { ok: false, message: PHRASE_RESEAU }
  }
  if (!res.ok) return { ok: false, message: 'Vos devis et factures n’ont pas pu être chargés. Réessayez.' }
  const json = await res.json().catch(() => null) as { documents?: Document[] } | null
  return { ok: true, data: json?.documents ?? [] }
}

/** `deja` : la facture existait déjà (deux taps sur « Transformer »), aucun numéro n'a été
 *  consommé — l'écran ne doit alors pas reposer la question du paiement. */
type Emission = { id: string; numero: string | null; deja?: boolean }

export async function creerDocument(saisie: SaisieDocument): Promise<ResultatApi<Emission>> {
  const r = await appeler('enregistrer', 'POST', '/api/documents', { saisie })
  return r.ok ? { ok: true, data: (r.data ?? {}) as Emission } : r
}

/** Le devis accepté devient une facture, construite en base depuis son contenu figé. */
export async function facturerDevis(id: string): Promise<ResultatApi<Emission>> {
  const r = await appeler('enregistrer', 'POST', `/api/documents/${id}/facturer`)
  return r.ok ? { ok: true, data: (r.data ?? {}) as Emission } : r
}

export async function repondreDevis(id: string, statut: 'accepte' | 'refuse'): Promise<ResultatApi<null>> {
  const r = await appeler('enregistrer', 'PATCH', `/api/documents/${id}`, { statut })
  return r.ok ? { ok: true, data: null } : r
}

/** Dit qu'une facture a été payée — ou reprend le mot, en cas de faute de frappe. C'est ce seul
 *  drapeau qui la fait entrer dans l'« Encaissé » de Chiffres. */
export async function marquerPayee(id: string, paye: boolean): Promise<ResultatApi<null>> {
  const r = await appeler('enregistrer', 'PATCH', `/api/documents/${id}`, { paye })
  return r.ok ? { ok: true, data: null } : r
}

export async function envoyerDocument(id: string): Promise<ResultatApi<null>> {
  const r = await appeler('envoyer', 'POST', `/api/documents/${id}/envoyer`)
  return r.ok ? { ok: true, data: null } : r
}

export async function supprimerDevis(id: string): Promise<ResultatApi<null>> {
  const r = await appeler('supprimer', 'DELETE', `/api/documents/${id}`)
  return r.ok ? { ok: true, data: null } : r
}

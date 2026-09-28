// Appels de la Fiche client et de la Fiche entreprise (PWA) à `/api/clients/[cle]` et
// `/api/entreprises*`. Même contrat d'erreur que `prestationsApi`/`documentsApi` : une phrase
// claire du serveur pour un refus, une simple référence pour une panne.

import { appeler, type ResultatApi } from '@/lib/prestationsApi'

/** Dit qu'un client ne veut plus être contacté — ou revient dessus. C'est ce seul réglage qui
 *  exclut le client des crons de relance et de demande d'avis (voir `send-followups`,
 *  `send-reviews`). `cle` : voir `cleClient`, encodée pour l'URL. */
export async function marquerNePlusContacter(cle: string, nePlusContacter: boolean): Promise<ResultatApi<null>> {
  const r = await appeler('enregistrer', 'PATCH', `/api/clients/${encodeURIComponent(cle)}`, { nePlusContacter })
  return r.ok ? { ok: true, data: null } : r
}

/** « Supprime » un client dans la liste — en réalité un masquage, jamais une vraie
 *  suppression : voir `/api/clients/[cle]` DELETE. Ses réservations, ses documents et ses
 *  factures restent intacts, il disparaît seulement du fichier. */
export async function supprimerClient(cle: string): Promise<ResultatApi<null>> {
  const r = await appeler('supprimer', 'DELETE', `/api/clients/${encodeURIComponent(cle)}`)
  return r.ok ? { ok: true, data: null } : r
}

/** Rattache un client existant à une entreprise (ou l'en détache, `entrepriseId: null`) —
 *  fiche entreprise, 2026-09-28. Un contact n'existe que comme un client déjà connu (au moins
 *  une réservation ou un document) : voir `lib/entrepriseProfile.ts`. */
export async function rattacherEntreprise(
  cle: string, entrepriseId: string | null, role: string,
): Promise<ResultatApi<null>> {
  const r = await appeler('enregistrer', 'PATCH', `/api/clients/${encodeURIComponent(cle)}`, { entrepriseId, role })
  return r.ok ? { ok: true, data: null } : r
}

export async function creerEntreprise(nom: string, delaiPaiementJours: number | null): Promise<ResultatApi<{ id: string }>> {
  const r = await appeler('enregistrer', 'POST', '/api/entreprises', { nom, delaiPaiementJours })
  return r.ok ? { ok: true, data: (r.data ?? {}) as { id: string } } : r
}

export async function modifierEntreprise(
  id: string, champs: { nom?: string; delaiPaiementJours?: number | null },
): Promise<ResultatApi<null>> {
  const r = await appeler('enregistrer', 'PATCH', `/api/entreprises/${id}`, champs)
  return r.ok ? { ok: true, data: null } : r
}

/** Supprime une entreprise. Sans risque pour les réservations ni les factures : ses sites
 *  disparaissent avec elle, ses contacts redeviennent de simples clients — voir la route. */
export async function supprimerEntreprise(id: string): Promise<ResultatApi<null>> {
  const r = await appeler('supprimer', 'DELETE', `/api/entreprises/${id}`)
  return r.ok ? { ok: true, data: null } : r
}

export async function ajouterSite(entrepriseId: string, adresse: string, note: string): Promise<ResultatApi<{ id: string }>> {
  const r = await appeler('enregistrer', 'POST', `/api/entreprises/${entrepriseId}/sites`, { adresse, note })
  return r.ok ? { ok: true, data: (r.data ?? {}) as { id: string } } : r
}

export async function modifierSite(id: string, adresse: string, note: string): Promise<ResultatApi<null>> {
  const r = await appeler('enregistrer', 'PATCH', `/api/sites/${id}`, { adresse, note })
  return r.ok ? { ok: true, data: null } : r
}

export async function supprimerSite(id: string): Promise<ResultatApi<null>> {
  const r = await appeler('supprimer', 'DELETE', `/api/sites/${id}`)
  return r.ok ? { ok: true, data: null } : r
}

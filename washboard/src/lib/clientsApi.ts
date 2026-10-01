// Appels de la Fiche client et de la Fiche entreprise (PWA) à `/api/clients/[cle]` et
// `/api/entreprises*`. Même contrat d'erreur que `prestationsApi`/`documentsApi` : une phrase
// claire du serveur pour un refus, une simple référence pour une panne.

import { appeler, type ResultatApi } from '@/lib/prestationsApi'

const PHRASE_RESEAU = 'Vérifiez votre connexion et réessayez.'

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

/** Écrit le nom, le téléphone, les notes ou les véhicules d'un client — texte libre, fiche
 *  particulier/pro/entreprise (menu « Modifier la fiche », 2026-09-28). `undefined` laisse le
 *  champ tel quel côté serveur (voir la route) : on peut n'en changer qu'un seul. */
export async function modifierFiche(
  cle: string, champs: { notes?: string | null; vehicules?: string | null; nom?: string | null; telephone?: string | null },
): Promise<ResultatApi<null>> {
  const r = await appeler('enregistrer', 'PATCH', `/api/clients/${encodeURIComponent(cle)}`, champs)
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

// ── Tâches ─────────────────────────────────────────────────────────────────
// « Ajouter une tâche » (menu « … » de la fiche, 2026-09-28) : un pense-bête court —
// « Rappeler », « proposer l'intérieur » — pas un gestionnaire de projet. Pas d'échéance ni de
// priorité : un laveur qui en a besoin le note dans le texte lui-même.

export type ClientTache = { id: string; texte: string; faiteLe: string | null; creeLe: string }

/** Tâches OUVERTES de ce client, les plus récentes en premier — chargées à l'ouverture de la
 *  fiche, pas dans `clients/page.tsx` : la plupart des fiches n'en ont aucune, autant ne pas
 *  alourdir le chargement de tout le fichier pour ça (même choix que `lireDocuments` depuis la
 *  fiche entreprise). */
export async function listerTaches(cle: string): Promise<ResultatApi<ClientTache[]>> {
  let res: Response
  try {
    res = await fetch(`/api/clients/${encodeURIComponent(cle)}/taches`)
  } catch {
    return { ok: false, message: PHRASE_RESEAU }
  }
  if (!res.ok) return { ok: false, message: 'Les tâches n’ont pas pu être chargées. Réessayez.' }
  const json = await res.json().catch(() => null) as { taches?: ClientTache[] } | null
  return { ok: true, data: json?.taches ?? [] }
}

export async function creerTache(cle: string, texte: string): Promise<ResultatApi<ClientTache>> {
  const r = await appeler('enregistrer', 'POST', `/api/clients/${encodeURIComponent(cle)}/taches`, { texte })
  return r.ok ? { ok: true, data: r.data as ClientTache } : r
}

export async function marquerTacheFaite(id: string, faite: boolean): Promise<ResultatApi<null>> {
  const r = await appeler('enregistrer', 'PATCH', `/api/taches/${id}`, { faite })
  return r.ok ? { ok: true, data: null } : r
}

export async function supprimerTache(id: string): Promise<ResultatApi<null>> {
  const r = await appeler('supprimer', 'DELETE', `/api/taches/${id}`)
  return r.ok ? { ok: true, data: null } : r
}

// ── Fusionner un doublon ────────────────────────────────────────────────────
// Deux fiches sont en réalité la même personne (`lib/doublons.ts` les repère) : toutes les
// réservations et tous les documents de la fiche SOURCE prennent l'email et le téléphone de la
// fiche CIBLE, qui les absorbe. Irréversible — deux fiches redevenues une seule ne se
// re-séparent pas.
export async function fusionnerClients(
  cleSource: string, emailCible: string, telephoneCible: string,
): Promise<ResultatApi<null>> {
  const r = await appeler('enregistrer', 'POST', '/api/clients/fusionner', { cleSource, emailCible, telephoneCible })
  return r.ok ? { ok: true, data: null } : r
}

// ── RGPD ─────────────────────────────────────────────────────────────────────
// Droit d'accès et droit à l'effacement (articles 15 et 17 du RGPD) — voir la revue de l'agent
// `legal` du 2026-09-28 avant de construire ces deux actions.

/** Droit d'accès (article 15) : tout ce que WashBoard sait sur CE client. Générée entièrement
 *  dans le navigateur, depuis la fiche déjà chargée (`ClientProfile`) — aucune requête, comme
 *  `messageWhatsapp` et le reste de `lib/documents.ts`. `enregistrerExport` journalise
 *  seulement le fait que l'export a eu lieu (article 5.2, la responsabilité du laveur), jamais
 *  son contenu. */
export async function enregistrerExport(cle: string): Promise<ResultatApi<null>> {
  const r = await appeler('enregistrer', 'POST', `/api/clients/${encodeURIComponent(cle)}/rgpd`, { action: 'export' })
  return r.ok ? { ok: true, data: null } : r
}

/** Droit à l'effacement (article 17) : remplace nom, email, téléphone et adresse par des
 *  valeurs anonymes sur TOUTES les réservations et TOUS les documents de ce client — jamais les
 *  montants, dates ou numéros de facture (obligation comptable de 10 ans, article 17.3.b).
 *  Irréversible : voir la confirmation dans `ClientProfileModalV2.tsx`. */
export async function anonymiserClient(cle: string): Promise<ResultatApi<null>> {
  const r = await appeler('supprimer', 'POST', `/api/clients/${encodeURIComponent(cle)}/rgpd`, { action: 'anonymiser' })
  return r.ok ? { ok: true, data: null } : r
}

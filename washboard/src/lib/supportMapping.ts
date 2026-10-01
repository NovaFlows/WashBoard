// Conversion entre les lignes de `support_questions` / `support_messages`
// (schéma conçu par cyber, en anglais et à plat) et les types d'interface de
// `src/lib/support.ts` (en français, pensés pour l'affichage laveur/équipe).
//
// Isolé pour ne pas noyer ces conversions dans les routes API, et pour
// pouvoir vérifier sans base de données qu'un statut ou un auteur ne se
// perdent jamais dans la traduction.

import type { SupportConversationEquipe, SupportMessage, SupportThread } from './support'

export type SupportQuestionStatusDb = 'open' | 'resolved'
export type SupportAuthorTypeDb = 'washer' | 'team'

export type SupportMessageRow = {
  id: string
  author_type: SupportAuthorTypeDb
  body: string
  created_at: string
}

export type SupportQuestionRow = {
  id: string
  subject: string
  status: SupportQuestionStatusDb
  is_read_by_washer: boolean
  is_read_by_team: boolean
  // Curseurs de lecture par camp (colonnes ajoutées par cyber, nullable tant
  // qu'un camp n'a jamais lu ce fil). Optionnels ici aussi : une sélection qui
  // ne les demande pas (routes qui n'en ont pas besoin) ne doit pas casser le
  // typage, `countUnreadMessages` traite `undefined` comme `null`.
  last_read_by_washer_at?: string | null
  last_read_by_team_at?: string | null
  // Masquage réversible côté équipe (colonne ajoutée par cyber) : voir
  // `isThreadHiddenForTeam`. Optionnels tous les deux pour la même raison que
  // les curseurs de lecture ci-dessus — une sélection qui ne les demande pas
  // ne doit pas casser le typage.
  hidden_for_team_at?: string | null
  // Masquage côté laveur (« supprimer » une conversation de sa liste, PWA) : même
  // règle, voir `isThreadHiddenForWasher`.
  hidden_for_washer_at?: string | null
  last_message_at?: string
  support_messages?: SupportMessageRow[] | null
}

export type SupportWasherInfo = { name: string; slug: string }

export function dbStatusToUi(status: SupportQuestionStatusDb): 'ouverte' | 'resolue' {
  return status === 'resolved' ? 'resolue' : 'ouverte'
}

export function uiStatusToDb(status: 'ouverte' | 'resolue'): SupportQuestionStatusDb {
  return status === 'resolue' ? 'resolved' : 'open'
}

export function dbAuthorToUi(author: SupportAuthorTypeDb): 'laveur' | 'equipe' {
  return author === 'team' ? 'equipe' : 'laveur'
}

export function mapMessageRow(row: SupportMessageRow): SupportMessage {
  return {
    id: row.id,
    from: dbAuthorToUi(row.author_type),
    text: row.body,
    createdAt: row.created_at,
  }
}

/** Nombre de messages écrits par `from` et postérieurs à `lastReadAt`.
 *
 *  Piège identifié par cyber : en SQL, `created_at > NULL` ne vaut jamais
 *  vrai, donc un curseur `null` (camp qui n'a jamais lu ce fil) ne doit
 *  JAMAIS être transformé en filtre — il doit être omis, pour compter tous
 *  les messages de l'autre camp. Même règle si le curseur est illisible
 *  (chaîne invalide) : mieux vaut sur-compter que faire disparaître des
 *  messages en silence. */
export function countUnreadMessages(
  messages: Pick<SupportMessageRow, 'author_type' | 'created_at'>[] | null | undefined,
  from: SupportAuthorTypeDb,
  lastReadAt: string | null | undefined,
): number {
  const seuilBrut = lastReadAt ? new Date(lastReadAt).getTime() : null
  const seuil = seuilBrut !== null && Number.isFinite(seuilBrut) ? seuilBrut : null

  return (messages ?? []).filter(m => {
    if (m.author_type !== from) return false
    if (seuil === null) return true
    return new Date(m.created_at).getTime() > seuil
  }).length
}

/** Un fil masqué par l'équipe (bouton/glissement sur la boîte de réception,
 *  jamais une suppression : `hidden_for_team_at` seul ne suffit pas, sinon un
 *  nouveau message du laveur resterait masqué indéfiniment) redevient visible
 *  dès qu'il avance `last_message_at` — sans qu'aucune route n'ait besoin de
 *  « démasquer » explicitement. D'où la comparaison stricte : un masquage et
 *  un message posés à la même horodate (ordre de résolution improbable mais
 *  pas impossible) doivent laisser le fil visible, jamais l'inverse.
 *
 *  Comparaison strictement `>`, et tout doute (date absente ou illisible)
 *  penche vers VISIBLE : contrairement au reste du projet (refuser par
 *  défaut), masquer à tort un fil client coûte plus cher qu'un fil qui
 *  réapparaît à tort. */
export function isThreadHiddenForTeam(
  hiddenAt: string | null | undefined,
  lastMessageAt: string,
): boolean {
  if (!hiddenAt) return false
  const h = new Date(hiddenAt).getTime()
  const m = new Date(lastMessageAt).getTime()
  if (!Number.isFinite(h) || !Number.isFinite(m)) return false
  return h > m
}

/** Un fil que le LAVEUR a supprimé de sa liste (glisser vers la gauche, PWA) : masqué
 *  pour lui seul, l'équipe le garde. Même règle que côté équipe : un message
 *  postérieur au masquage — la réponse de l'équipe, typiquement — le fait
 *  réapparaître, pour qu'une réponse ne se perde jamais. */
export function isThreadHiddenForWasher(
  hiddenAt: string | null | undefined,
  lastMessageAt: string,
): boolean {
  return isThreadHiddenForTeam(hiddenAt, lastMessageAt)
}

/** Vue laveur d'un fil : `nonLue` reflète son propre indicateur de lecture,
 *  `vuParEquipe` celui de l'équipe — utilisé pour afficher « Vu ».
 *  `nonLuesCount` est le nombre de messages de l'équipe postérieurs à son
 *  dernier passage sur ce fil (voir `countUnreadMessages`). */
export function mapThreadRow(row: SupportQuestionRow): SupportThread {
  return {
    id: row.id,
    title: row.subject,
    status: dbStatusToUi(row.status),
    nonLue: !row.is_read_by_washer,
    vuParEquipe: row.is_read_by_team,
    nonLuesCount: countUnreadMessages(row.support_messages, 'team', row.last_read_by_washer_at),
    messages: (row.support_messages ?? []).map(mapMessageRow),
  }
}

/** Vue équipe d'une conversation : `nonLue` reflète l'indicateur de lecture
 *  de l'équipe, `vuParLaveur` celui du laveur (pour « Vu ») — les deux
 *  évoluent indépendamment. `nonLuesCount` est le nombre de messages du
 *  laveur postérieurs au dernier passage de l'équipe sur ce fil. */
export function mapConversationRow(row: SupportQuestionRow, washer: SupportWasherInfo): SupportConversationEquipe {
  return {
    id: row.id,
    washerName: washer.name,
    washerSlug: washer.slug,
    status: dbStatusToUi(row.status),
    nonLue: !row.is_read_by_team,
    vuParLaveur: row.is_read_by_washer,
    nonLuesCount: countUnreadMessages(row.support_messages, 'washer', row.last_read_by_team_at),
    messages: (row.support_messages ?? []).map(mapMessageRow),
  }
}

/** Lien direct vers un fil, contrat partagé avec l'interface (`designer`) :
 *  `/dashboard/assistance?fil=<id>`. Centralisé ici pour que la notification
 *  push envoyée au laveur et l'email de réponse de l'équipe pointent
 *  toujours vers exactement la même URL. */
export function assistanceThreadUrl(questionId: string): string {
  return `/dashboard/assistance?fil=${encodeURIComponent(questionId)}`
}

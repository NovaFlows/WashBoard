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

/** Vue laveur d'un fil : `nonLue` reflète son propre indicateur de lecture. */
export function mapThreadRow(row: SupportQuestionRow): SupportThread {
  return {
    id: row.id,
    title: row.subject,
    status: dbStatusToUi(row.status),
    nonLue: !row.is_read_by_washer,
    messages: (row.support_messages ?? []).map(mapMessageRow),
  }
}

/** Vue équipe d'une conversation : `nonLue` reflète l'indicateur de lecture
 *  de l'équipe, pas celui du laveur — les deux évoluent indépendamment. */
export function mapConversationRow(row: SupportQuestionRow, washer: SupportWasherInfo): SupportConversationEquipe {
  return {
    id: row.id,
    washerName: washer.name,
    washerSlug: washer.slug,
    status: dbStatusToUi(row.status),
    nonLue: !row.is_read_by_team,
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

// Types du canal de question directe entre un laveur bloqué et l'équipe
// NovaFlows, depuis le centre d'aide (guide) et la page interne /dashboard/support.
//
// Modèle : PLUSIEURS fils par laveur, pas une conversation unique — un fil
// par question, avec son propre état ouverte/résolue (table conçue par
// l'agent cyber). Le laveur ne choisit jamais de titre : il est déduit côté
// serveur de la première ligne de son message initial.
//
// Ces types sont un contrat d'interface : la lecture/écriture réelle
// (Supabase, notifications) reste à brancher côté serveur.

export type SupportMessage = {
  id: string
  from: 'laveur' | 'equipe'
  text: string
  createdAt: string // ISO
}

export type SupportConversation = {
  status: 'ouverte' | 'resolue'
  messages: SupportMessage[]
}

/** Un fil de questions/réponses, côté laveur : un souci = un fil, pour que
 *  « résolue » reste précis (facturation et calendrier ne se mélangent pas). */
export type SupportThread = SupportConversation & {
  id: string
  /** Déduit côté serveur de la première ligne du message initial — jamais saisi par le laveur. */
  title: string
  /** L'équipe a répondu et le laveur n'a pas encore ouvert le fil depuis. */
  nonLue?: boolean
}

/** Vue équipe : une conversation par laveur, avec de quoi l'identifier et
 *  savoir si son dernier message a déjà été vu. */
export type SupportConversationEquipe = SupportConversation & {
  id: string
  washerName: string
  washerSlug: string
  /** Un message du laveur n'a pas encore été vu par l'équipe. */
  nonLue: boolean
}

export function formatSupportDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Petit bus d'événements pour synchroniser la pastille « réponse non lue »
// (menu latéral + bouton ☰, voir useSupportUnreadBadge) avec l'instant où un
// fil est réellement ouvert par le laveur, sans attendre un rechargement de
// page ni faire dépendre le menu (rendu dans DashboardShell) de l'état d'une
// page qui n'a aucun lien de composant avec lui (GuideContent, AssistanceContent).

export const SUPPORT_THREAD_READ_EVENT = 'wb:support-thread-read'

/** À appeler dès qu'un fil vient d'être ouvert par le laveur (avant même la
 *  confirmation serveur : la pastille est décorative, pas une source de vérité). */
export function notifySupportThreadRead() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SUPPORT_THREAD_READ_EVENT))
}

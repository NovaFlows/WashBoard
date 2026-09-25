// Où la connexion Google Agenda ramène l'utilisateur. Le site revient sur
// `/dashboard/admin` (comportement historique, inchangé) ; la PWA installée, elle,
// démarre la connexion depuis l'Agenda (`?retour=agenda`) et doit y revenir.
//
// Le choix voyage dans le paramètre `state`, sous forme d'un suffixe. Il n'y a
// donc rien à falsifier : le retour compare déjà `state` au cookie httpOnly déposé
// au départ, mot pour mot. Un suffixe absent du cookie fait échouer cette
// comparaison comme n'importe quel `state` inconnu.

export const SUFFIXE_RETOUR_AGENDA = '.agenda'

export function etatConnexionGoogle(jetonAleatoire: string, versAgenda: boolean): string {
  return versAgenda ? `${jetonAleatoire}${SUFFIXE_RETOUR_AGENDA}` : jetonAleatoire
}

export function retourVersAgenda(etat: string): boolean {
  return etat.endsWith(SUFFIXE_RETOUR_AGENDA)
}

export type IssueConnexionGoogle = 'ok' | 'erreur' | 'sans-jeton'

/** Adresse de retour, absolue. `base` : l'origine de l'application, sans « / » final. */
export function destinationRetourGoogle(base: string, versAgenda: boolean, issue: IssueConnexionGoogle): string {
  if (versAgenda) return `${base}/dashboard/calendrier?google=${issue}`
  if (issue === 'ok') return `${base}/dashboard/admin?tab=identite&success=google-calendar`
  if (issue === 'sans-jeton') return `${base}/dashboard/admin?error=google-calendar-no-token`
  return `${base}/dashboard/admin?error=google-calendar`
}

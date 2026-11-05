// Suivi des appels de l'équipe aux laveurs (table `suivi_appels`, 2026-11-05) :
// ce qu'Alexandre notait dans `prospects/suivi_clients.xlsx`, désormais dans la
// fiche du laveur. Visible de l'équipe seule — la table n'a aucune politique
// RLS, seules les routes serveur (service_role) y accèdent.

export const RESULTATS_APPEL = [
  'Pas répondu',
  'Rappeler',
  'Page configurée ensemble',
  'Intéressé',
  'Va payer',
  'Pas intéressé',
  'Injoignable',
] as const

/** Pas un appel : le laveur est mis dans « À rappeler » depuis sa fiche (bouton
 *  « À rappeler »). Une ligne du suivi comme une autre, pour que la règle « seul
 *  le dernier élément du suivi compte » reste vraie : noter un appel ensuite
 *  remplace cette relance. */
export const MISE_A_RAPPELER = 'À rappeler'

export type ResultatAppel = (typeof RESULTATS_APPEL)[number] | typeof MISE_A_RAPPELER

/** Vrai appel (pas une simple mise dans « À rappeler »). */
export function estAppel(a: Pick<Appel, 'resultat'>): boolean {
  return a.resultat !== MISE_A_RAPPELER
}

export type Appel = {
  id: string
  washer_id: string
  appele_le: string
  resultat: ResultatAppel
  notes: string | null
  prochaine_action: string | null
  /** Date seule (AAAA-MM-JJ) : on relance un jour, pas à une heure. */
  relancer_le: string | null
}

export const LONGUEUR_MAX_NOTES = 4000
export const LONGUEUR_MAX_ACTION = 300

/** Valide une saisie d'appel. Renvoie le message à afficher, ou les champs propres. */
export function validerAppel(corps: unknown): { erreur: string } | { appel: Omit<Appel, 'id' | 'washer_id' | 'appele_le'> } {
  const c = (corps ?? {}) as Record<string, unknown>
  const miseARappeler = c.resultat === MISE_A_RAPPELER
  if (!miseARappeler && !RESULTATS_APPEL.includes(c.resultat as (typeof RESULTATS_APPEL)[number])) return { erreur: 'Choisissez le résultat de l’appel.' }
  const texte = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
  let relancer: string | null = null
  if (c.relancer_le != null && c.relancer_le !== '') {
    if (typeof c.relancer_le !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(c.relancer_le) || Number.isNaN(Date.parse(c.relancer_le))) {
      return { erreur: 'Date de relance invalide.' }
    }
    relancer = c.relancer_le
  }
  // Mis dans « À rappeler » sans date : à rappeler aujourd'hui.
  if (miseARappeler && !relancer) relancer = aujourdhuiParis()
  return {
    appel: {
      resultat: c.resultat as ResultatAppel,
      notes: texte(c.notes, LONGUEUR_MAX_NOTES),
      prochaine_action: texte(c.prochaine_action, LONGUEUR_MAX_ACTION),
      relancer_le: relancer,
    },
  }
}

/** Modification de la relance d'une ligne du suivi (date, motif). Une mise « À rappeler »
 *  garde toujours une date : sans date, elle n'aurait plus de sens — on la retire. */
export function validerModificationRelance(corps: unknown, resultat: string): { erreur: string } | { modif: Pick<Appel, 'relancer_le' | 'prochaine_action'> } {
  const c = (corps ?? {}) as Record<string, unknown>
  let relancer: string | null = null
  if (c.relancer_le != null && c.relancer_le !== '') {
    if (typeof c.relancer_le !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(c.relancer_le) || Number.isNaN(Date.parse(c.relancer_le))) {
      return { erreur: 'Date de relance invalide.' }
    }
    relancer = c.relancer_le
  }
  if (resultat === MISE_A_RAPPELER && !relancer) return { erreur: 'Choisissez une date, ou retirez-le de « À rappeler ».' }
  const action = typeof c.prochaine_action === 'string' && c.prochaine_action.trim() ? c.prochaine_action.trim().slice(0, LONGUEUR_MAX_ACTION) : null
  return { modif: { relancer_le: relancer, prochaine_action: action } }
}

/** Date du jour à Paris, AAAA-MM-JJ — comparable aux `relancer_le`. */
export function aujourdhuiParis(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })
}

/** La relance fixée par le dernier élément du suivi, due ou à venir. */
export function relancePrevue(appels: Appel[]): Appel | null {
  const dernier = [...appels].sort((a, b) => b.appele_le.localeCompare(a.appele_le))[0]
  return dernier?.relancer_le ? dernier : null
}

/** La relance prévue au dernier appel, si elle est due (aujourd'hui ou passée). */
export function relanceDue(appels: Appel[], now: Date = new Date()): Appel | null {
  const prevue = relancePrevue(appels)
  return prevue && prevue.relancer_le! <= aujourdhuiParis(now) ? prevue : null
}

/** La table n'existe pas encore (SQL pas encore passé) : PostgREST répond 42P01
 *  ou PGRST205. La fiche s'affiche alors sans suivi plutôt que de tomber. */
export function tableAbsente(erreur: unknown): boolean {
  const code = (erreur as { code?: string } | null)?.code
  return code === '42P01' || code === 'PGRST205'
}

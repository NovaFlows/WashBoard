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

export type ResultatAppel = (typeof RESULTATS_APPEL)[number]

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
  if (!RESULTATS_APPEL.includes(c.resultat as ResultatAppel)) return { erreur: 'Choisissez le résultat de l’appel.' }
  const texte = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
  let relancer: string | null = null
  if (c.relancer_le != null && c.relancer_le !== '') {
    if (typeof c.relancer_le !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(c.relancer_le) || Number.isNaN(Date.parse(c.relancer_le))) {
      return { erreur: 'Date de relance invalide.' }
    }
    relancer = c.relancer_le
  }
  return {
    appel: {
      resultat: c.resultat as ResultatAppel,
      notes: texte(c.notes, LONGUEUR_MAX_NOTES),
      prochaine_action: texte(c.prochaine_action, LONGUEUR_MAX_ACTION),
      relancer_le: relancer,
    },
  }
}

/** Date du jour à Paris, AAAA-MM-JJ — comparable aux `relancer_le`. */
export function aujourdhuiParis(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })
}

/** La relance prévue au dernier appel, si elle est due (aujourd'hui ou passée). */
export function relanceDue(appels: Appel[], now: Date = new Date()): Appel | null {
  const dernier = [...appels].sort((a, b) => b.appele_le.localeCompare(a.appele_le))[0]
  if (!dernier?.relancer_le) return null
  return dernier.relancer_le <= aujourdhuiParis(now) ? dernier : null
}

/** La table n'existe pas encore (SQL pas encore passé) : PostgREST répond 42P01
 *  ou PGRST205. La fiche s'affiche alors sans suivi plutôt que de tomber. */
export function tableAbsente(erreur: unknown): boolean {
  const code = (erreur as { code?: string } | null)?.code
  return code === '42P01' || code === 'PGRST205'
}

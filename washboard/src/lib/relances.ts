// Décisions de la relance des anciens clients (cron `send-followups`).
//
// La marque `followup_sent_at` veut dire « relance TRAITÉE » : envoyée, ou
// devenue inutile. Avant, un rendez-vous qu'on décidait de ne pas relancer ne
// recevait aucune marque : il restait candidat pour toujours, relu et revérifié
// chaque jour, et ces rendez-vous morts pouvaient occuper le lot de 500 au point
// que les clients les plus anciens n'étaient jamais atteints.

type Candidat = { id: string; client_email: string }

/** Un seul message par client : son rendez-vous le plus récent porte la relance.
 *  Les plus anciens sont clos tout de suite — le plus récent est lui aussi un
 *  candidat (passé, confirmé ou terminé), il sera relancé ou clos à son tour.
 *
 *  @param candidats triés du plus récent au plus ancien. */
export function repartirParClient<T extends Candidat>(candidats: T[]): { porteurs: T[]; aClore: string[] } {
  const vus = new Set<string>()
  const porteurs: T[] = []
  const aClore: string[] = []
  for (const c of candidats) {
    if (vus.has(c.client_email)) aClore.push(c.id)
    else { vus.add(c.client_email); porteurs.push(c) }
  }
  return { porteurs, aClore }
}

export type DecisionRelance = 'relancer' | 'clore' | 'attendre'

/** Que faire d'un rendez-vous au vu des rendez-vous PLUS RÉCENTS du même client
 *  (annulés exclus) ?
 *  - aucun : le client n'est pas revenu → on relance ;
 *  - un rendez-vous déjà passé, confirmé ou terminé : il est revenu, et c'est ce
 *    rendez-vous-là qui portera la relance le moment venu → on clôt celui-ci ;
 *  - seulement des rendez-vous à venir ou en attente : on ne clôt pas encore.
 *    Si ce rendez-vous était annulé, le client doit rester relançable. */
export function decisionPlusRecents(
  plusRecents: { status: string; scheduled_at: string }[],
  maintenant: Date,
): DecisionRelance {
  if (plusRecents.length === 0) return 'relancer'
  const revenu = plusRecents.some(r =>
    (r.status === 'confirmed' || r.status === 'done') && new Date(r.scheduled_at) <= maintenant)
  return revenu ? 'clore' : 'attendre'
}

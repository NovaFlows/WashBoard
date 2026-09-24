// Onglet « Acquisition » de Chiffres : les visites de la page de réservation
// rangées par créneau (heure, jour, mois) pour le graphique, et la mention
// honnête quand la période demandée dépasse ce que la page a chargé.
//
// Les autres statistiques de l'onglet (entonnoir, sources, appareils,
// horaires) restent celles de `funnelStats.ts`, calculées sur les mêmes
// événements retenus.

import {
  bornesInstants, creneauDe, creneauxDe, jourParisDe, plageDe, rognerHeures,
  type Creneau, type PeriodeChiffres,
} from './chiffresPeriode'

export type EvenementVisite = { session_id: string; created_at: string }

export type PointVisites = Creneau & {
  visiteurs: number
  futur: boolean
  courant: boolean
}

/** Événements dont l'instant tombe dans la période (bornes de Paris). */
export function evenementsDansLaPeriode<T extends { created_at: string }>(events: T[], p: PeriodeChiffres): T[] {
  const { debut, fin } = bornesInstants(p)
  return events.filter(e => {
    const t = new Date(e.created_at).getTime()
    return Number.isFinite(t) && t >= debut.getTime() && t < fin.getTime()
  })
}

/** Visiteurs par créneau. Une session compte UNE fois, dans le créneau de son
 *  premier événement — même règle que `buildVisitTimingBreakdown`. La somme
 *  des barres est donc le nombre de sessions distinctes de la période. */
export function serieVisites(p: PeriodeChiffres, events: EvenementVisite[], maintenant: number): PointVisites[] {
  const creneaux = creneauxDe(p)
  const { debut, fin } = plageDe(p)
  const compteur = new Map(creneaux.map(c => [c.cle, 0]))

  const premier = new Map<string, number>()
  for (const e of events) {
    const t = new Date(e.created_at).getTime()
    if (!Number.isFinite(t)) continue
    const vu = premier.get(e.session_id)
    if (vu === undefined || t < vu) premier.set(e.session_id, t)
  }
  for (const t of premier.values()) {
    const c = creneauDe(p, t)
    if (!c || c.jour < debut || c.jour > fin) continue
    if (compteur.has(c.cle)) compteur.set(c.cle, compteur.get(c.cle)! + 1)
  }

  const now = creneauDe(p, maintenant)
  const enCours = !!now && now.jour >= debut && now.jour <= fin
  const points = creneaux.map(c => ({
    ...c,
    visiteurs: compteur.get(c.cle) ?? 0,
    futur: enCours && c.cle > now!.cle && (compteur.get(c.cle) ?? 0) === 0,
    courant: enCours && c.cle === now!.cle,
  }))
  return p.type === 'jour' ? rognerHeures(points, x => x.visiteurs > 0 || x.courant) : points
}

export type CouvertureEvenements = {
  /** `complete` : tout ce qui s'est passé dans la période est chargé.
   *  `partielle` : la période commence avant le début de l'historique chargé.
   *  `aucune` : elle finit avant — rien n'est chargé, un zéro serait faux. */
  etat: 'complete' | 'partielle' | 'aucune'
  /** Premier jour couvert (`AAAA-MM-JJ`, Paris), pour le message. */
  depuisJour: string | null
}

/** La page ne charge les visites que sur une fenêtre glissante (365 jours,
 *  `chiffres/page.tsx`). Avant, il n'y a pas « zéro visite » : il n'y a pas de
 *  donnée. La différence se dit au laveur. */
export function couvertureEvenements(p: PeriodeChiffres, depuis: string | null): CouvertureEvenements {
  if (!depuis) return { etat: 'complete', depuisJour: null }
  const depuisMs = new Date(depuis).getTime()
  if (!Number.isFinite(depuisMs)) return { etat: 'complete', depuisJour: null }
  const { debut, fin } = bornesInstants(p)
  const depuisJour = jourParisDe(depuisMs)
  if (depuisMs <= debut.getTime()) return { etat: 'complete', depuisJour }
  if (depuisMs >= fin.getTime()) return { etat: 'aucune', depuisJour }
  return { etat: 'partielle', depuisJour }
}

import { toDateStr, getMondayOf } from '@/lib/dateUtils'

// Calcul des périodes comptables, extrait de `ComptaDashboard.tsx` où il
// n'était couvert par aucun test — alors qu'il décide sur quelle plage de
// dates le chiffre d'affaires et les dépenses sont calculés. Une erreur ici
// donne au laveur un résultat faux sans qu'aucune alerte ne se déclenche.

export type PeriodType = 'jour' | 'semaine' | 'mois' | 'annee'

export type PeriodRange = { start: string; end: string; label: string }

const MOIS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

/** Plage de dates (incluse) et libellé d'affichage pour une période.
 *
 *  Les bornes sont formatées avec `toDateStr`, qui lit la date **locale**.
 *  L'ancienne version utilisait `toISOString()`, qui convertit d'abord en UTC :
 *  la France étant toujours en avance sur UTC, toute date prise à minuit
 *  reculait d'un jour. Concrètement, la semaine comptable commençait le
 *  dimanche au lieu du lundi, et la vue « Jour » consultée avant 2 h du matin
 *  affichait la veille. */
export function getPeriodRange(type: PeriodType, ref: Date): PeriodRange {
  const d = new Date(ref)

  if (type === 'jour') {
    const s = toDateStr(d)
    return {
      start: s,
      end: s,
      label: d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    }
  }

  if (type === 'semaine') {
    const lundi = getMondayOf(d)
    const dimanche = new Date(lundi)
    dimanche.setDate(lundi.getDate() + 6)
    return {
      start: toDateStr(lundi),
      end: toDateStr(dimanche),
      label: `${lundi.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${dimanche.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    }
  }

  if (type === 'mois') {
    const y = d.getFullYear()
    const m = d.getMonth()
    const dernierJour = new Date(y, m + 1, 0).getDate()
    return {
      start: toDateStr(new Date(y, m, 1)),
      end: toDateStr(new Date(y, m, dernierJour)),
      label: `${MOIS_FR[m]} ${y}`,
    }
  }

  const y = d.getFullYear()
  return { start: `${y}-01-01`, end: `${y}-12-31`, label: String(y) }
}

/** Période précédente (`-1`) ou suivante (`+1`). */
export function navigatePeriod(type: PeriodType, ref: Date, dir: 1 | -1): Date {
  const d = new Date(ref)
  switch (type) {
    case 'jour':    d.setDate(d.getDate() + dir); break
    case 'semaine': d.setDate(d.getDate() + dir * 7); break
    case 'mois':    d.setMonth(d.getMonth() + dir); break
    case 'annee':   d.setFullYear(d.getFullYear() + dir); break
  }
  return d
}

/** La période affichée est-elle celle en cours ? (pour griser « suivant ») */
export function isCurrentPeriod(ref: Date, type: PeriodType, now: Date = new Date()): boolean {
  switch (type) {
    case 'jour':    return toDateStr(ref) === toDateStr(now)
    case 'semaine': return toDateStr(getMondayOf(ref)) === toDateStr(getMondayOf(now))
    case 'mois':    return ref.getFullYear() === now.getFullYear() && ref.getMonth() === now.getMonth()
    case 'annee':   return ref.getFullYear() === now.getFullYear()
  }
}

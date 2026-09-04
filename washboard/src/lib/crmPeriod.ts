// Période sélectionnée dans le CRM, et sa conversion en plage de dates.
//
// Le sélecteur du CRM ne fonctionne pas comme celui de la comptabilité : il ne
// se déplace pas autour d'une date de référence, il désigne directement une
// année, un mois, une semaine ou un jour précis. D'où ce module distinct
// plutôt qu'une réutilisation forcée de `comptaPeriod`.
//
// La conversion vit ici parce qu'elle sert désormais à DEUX endroits — les
// réservations et les statistiques de visite. Deux filtrages écrits séparément
// finiraient par diverger, et l'écran afficherait des réservations et des
// visiteurs portant sur des périodes différentes sans que rien ne le signale.

export type CrmPeriodType = 'all' | 'year' | 'month' | 'week' | 'day'

export type CrmPeriodState = {
  type: CrmPeriodType
  year: number
  /** 0 = janvier. */
  month: number
  /** Lundi de la semaine choisie. */
  weekStart: Date
  /** Jour choisi, au format AAAA-MM-JJ. */
  day: string
}

/** Bornes de la période : `start` inclus, `end` exclu.
 *
 *  `null` pour « Tout » — aucune borne, pas une plage infinie : l'appelant
 *  doit alors ne filtrer sur rien du tout. */
export function getCrmPeriodBounds(p: CrmPeriodState): { start: Date; end: Date } | null {
  switch (p.type) {
    case 'all':
      return null

    case 'year':
      return { start: new Date(p.year, 0, 1), end: new Date(p.year + 1, 0, 1) }

    case 'month':
      return { start: new Date(p.year, p.month, 1), end: new Date(p.year, p.month + 1, 1) }

    case 'week': {
      const start = new Date(p.weekStart)
      start.setHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setDate(start.getDate() + 7)
      return { start, end }
    }

    case 'day': {
      // Découpage manuel plutôt que `new Date(p.day)` : cette forme est
      // interprétée en UTC par le navigateur, ce qui décale la journée d'un
      // cran en France et ferait apparaître les rendez-vous de la veille.
      const [a, m, j] = p.day.split('-').map(Number)
      if (!a || !m || !j) return null
      const start = new Date(a, m - 1, j)
      const end = new Date(a, m - 1, j + 1)
      return { start, end }
    }
  }
}

/** La date tombe-t-elle dans la période ? */
export function isInCrmPeriod(date: Date, p: CrmPeriodState): boolean {
  const bornes = getCrmPeriodBounds(p)
  if (!bornes) return true
  const t = date.getTime()
  if (!Number.isFinite(t)) return false
  return t >= bornes.start.getTime() && t < bornes.end.getTime()
}

/** Intitulé de la période, pour dire sur quoi portent les chiffres affichés. */
export function crmPeriodLabel(p: CrmPeriodState): string {
  const bornes = getCrmPeriodBounds(p)
  if (!bornes) return 'Depuis le début'

  switch (p.type) {
    case 'year':
      return `En ${p.year}`
    case 'month':
      return bornes.start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    case 'week': {
      const fin = new Date(bornes.end)
      fin.setDate(fin.getDate() - 1)
      const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
      return `Du ${bornes.start.toLocaleDateString('fr-FR', opts)} au ${fin.toLocaleDateString('fr-FR', opts)}`
    }
    case 'day':
      return bornes.start.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    default:
      return 'Depuis le début'
  }
}

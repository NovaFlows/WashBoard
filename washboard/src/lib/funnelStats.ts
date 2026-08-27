import type { FunnelStep } from './funnelTracking'

export type FunnelEventRow = { step: FunnelStep; session_id: string }

export type FunnelStepStat = {
  step:  FunnelStep
  label: string
  sessions: number
  /** % de la première étape (prestation) qui atteint celle-ci. */
  pctOfFirst: number
  /** % perdu par rapport à l'étape précédente (0 pour la première). */
  pctDropFromPrevious: number
}

const STEP_LABELS: Record<FunnelStep, string> = {
  prestation:   'Prestation choisie',
  options:      'Options vues',
  creneau:      'Créneau choisi',
  coordonnees:  'Coordonnées saisies',
  confirmation: 'Réservation confirmée',
}

// L'étape "options" n'existe que pour les prestations avec options : l'exclure
// du tunnel principal évite un faux décrochage pour les laveurs qui n'en ont
// pas. Elle reste disponible dans STEP_LABELS si on veut l'afficher à part.
const CORE_FUNNEL_STEPS: FunnelStep[] = ['prestation', 'creneau', 'coordonnees', 'confirmation']

/** Agrège des événements bruts en statistiques d'entonnoir (pure, testable).
 *  Compte les SESSIONS distinctes par étape (pas les événements bruts), pour
 *  qu'un visiteur qui va-et-vient entre étapes ne soit pas compté plusieurs
 *  fois. */
export function buildFunnelSummary(events: FunnelEventRow[]): FunnelStepStat[] {
  const sessionsByStep = new Map<FunnelStep, Set<string>>()
  for (const { step, session_id } of events) {
    if (!sessionsByStep.has(step)) sessionsByStep.set(step, new Set())
    sessionsByStep.get(step)!.add(session_id)
  }

  const firstStepCount = sessionsByStep.get(CORE_FUNNEL_STEPS[0])?.size ?? 0
  let previousCount = firstStepCount

  return CORE_FUNNEL_STEPS.map((step, i) => {
    const sessions = sessionsByStep.get(step)?.size ?? 0
    const pctOfFirst = firstStepCount > 0 ? Math.round((sessions / firstStepCount) * 100) : 0
    const pctDropFromPrevious = i === 0 || previousCount === 0
      ? 0
      : Math.round(((previousCount - sessions) / previousCount) * 100)
    previousCount = sessions
    return { step, label: STEP_LABELS[step], sessions, pctOfFirst, pctDropFromPrevious }
  })
}

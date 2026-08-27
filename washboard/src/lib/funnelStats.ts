import type { FunnelStep, Device } from './funnelTracking'

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

/** Compte les sessions distinctes dans une liste d'événements (pure). Sert
 *  notamment à comparer le nombre de visiteurs entre deux périodes. */
export function countDistinctSessions(events: { session_id: string }[]): number {
  return new Set(events.map(e => e.session_id)).size
}

export type DeviceBreakdownItem = { device: Device | 'inconnu'; sessions: number; pct: number }

/** Répartition des visiteurs par type d'appareil, une session ne comptant
 *  qu'une fois (on garde le premier appareil rencontré pour cette session).
 *  Les sessions sans info d'appareil sont classées "inconnu" plutôt que
 *  supprimées silencieusement — un événement mal formé ne doit pas juste
 *  disparaître des stats. */
export function buildDeviceBreakdown(events: { session_id: string; device?: Device | null }[]): DeviceBreakdownItem[] {
  const deviceBySession = new Map<string, Device | 'inconnu'>()
  for (const { session_id, device } of events) {
    if (!deviceBySession.has(session_id)) deviceBySession.set(session_id, device ?? 'inconnu')
  }

  const counts = new Map<Device | 'inconnu', number>()
  for (const device of deviceBySession.values()) {
    counts.set(device, (counts.get(device) ?? 0) + 1)
  }

  const total = deviceBySession.size
  return [...counts.entries()]
    .map(([device, sessions]) => ({ device, sessions, pct: total > 0 ? Math.round((sessions / total) * 100) : 0 }))
    .sort((a, b) => b.sessions - a.sessions)
}

export type ReferrerBreakdownItem = { host: string; sessions: number; pct: number }

/** Répartition des visiteurs par source de trafic (nom d'hôte du referrer,
 *  déjà anonymisé en amont — voir extractReferrerHost). "direct" regroupe les
 *  accès sans referrer (lien direct, appli messagerie, etc.), une session ne
 *  comptant qu'une fois. */
export function buildReferrerBreakdown(events: { session_id: string; referrer_host?: string | null }[]): ReferrerBreakdownItem[] {
  const hostBySession = new Map<string, string>()
  for (const { session_id, referrer_host } of events) {
    if (!hostBySession.has(session_id)) hostBySession.set(session_id, referrer_host || 'direct')
  }

  const counts = new Map<string, number>()
  for (const host of hostBySession.values()) {
    counts.set(host, (counts.get(host) ?? 0) + 1)
  }

  const total = hostBySession.size
  return [...counts.entries()]
    .map(([host, sessions]) => ({ host, sessions, pct: total > 0 ? Math.round((sessions / total) * 100) : 0 }))
    .sort((a, b) => b.sessions - a.sessions)
}

/** Estime le pic de visiteurs simultanés en cherchant, sur une fenêtre
 *  glissante de `windowMs`, le nombre maximal de sessions distinctes ayant
 *  émis au moins un événement dans cette fenêtre.
 *
 *  ⚠️ Approximation, pas une mesure temps réel (WashBoard n'a pas de
 *  websocket/présence) : on ne connaît que les timestamps des événements
 *  d'étape, pas la durée réelle passée par chaque visiteur sur la page. Deux
 *  sessions dont les événements tombent dans la même fenêtre d'1h sont
 *  comptées comme "simultanées" même si l'une a quitté la page avant que
 *  l'autre n'arrive — le chiffre obtenu est donc un majorant plausible, pas
 *  un pic exact. */
export function estimatePeakConcurrentSessions(
  events: { session_id: string; created_at: string }[],
  windowMs: number = 60 * 60 * 1000,
): number {
  if (events.length === 0) return 0

  const sorted = events
    .map(e => ({ session_id: e.session_id, t: new Date(e.created_at).getTime() }))
    .sort((a, b) => a.t - b.t)

  const activeCounts = new Map<string, number>()
  let left = 0
  let peak = 0

  for (let right = 0; right < sorted.length; right++) {
    const current = sorted[right]
    activeCounts.set(current.session_id, (activeCounts.get(current.session_id) ?? 0) + 1)

    while (current.t - sorted[left].t > windowMs) {
      const outgoing = sorted[left]
      const count = activeCounts.get(outgoing.session_id) ?? 0
      if (count <= 1) activeCounts.delete(outgoing.session_id)
      else activeCounts.set(outgoing.session_id, count - 1)
      left++
    }

    if (activeCounts.size > peak) peak = activeCounts.size
  }

  return peak
}

export type DeviceConversionItem = {
  device: Device | 'inconnu'
  sessions: number
  conversions: number
  conversionRate: number
}

/** Taux de conversion (jusqu'à "confirmation") par type d'appareil — même
 *  regroupement par session que buildDeviceBreakdown, croisé avec l'ensemble
 *  des sessions ayant atteint l'étape finale. */
export function buildDeviceConversionBreakdown(
  events: { session_id: string; device?: Device | null; step: FunnelStep }[],
): DeviceConversionItem[] {
  const deviceBySession = new Map<string, Device | 'inconnu'>()
  for (const { session_id, device } of events) {
    if (!deviceBySession.has(session_id)) deviceBySession.set(session_id, device ?? 'inconnu')
  }
  const confirmedSessions = new Set(events.filter(e => e.step === 'confirmation').map(e => e.session_id))

  const sessionsByDevice = new Map<Device | 'inconnu', number>()
  const conversionsByDevice = new Map<Device | 'inconnu', number>()
  for (const [sessionId, device] of deviceBySession) {
    sessionsByDevice.set(device, (sessionsByDevice.get(device) ?? 0) + 1)
    if (confirmedSessions.has(sessionId)) conversionsByDevice.set(device, (conversionsByDevice.get(device) ?? 0) + 1)
  }

  return [...sessionsByDevice.entries()]
    .map(([device, sessions]) => {
      const conversions = conversionsByDevice.get(device) ?? 0
      return { device, sessions, conversions, conversionRate: sessions > 0 ? Math.round((conversions / sessions) * 100) : 0 }
    })
    .sort((a, b) => b.sessions - a.sessions)
}

export type ReferrerConversionItem = {
  host: string
  sessions: number
  conversions: number
  conversionRate: number
}

/** Taux de conversion (jusqu'à "confirmation") par source de trafic — même
 *  regroupement par session que buildReferrerBreakdown, croisé avec
 *  l'ensemble des sessions ayant atteint l'étape finale. */
export function buildReferrerConversionBreakdown(
  events: { session_id: string; referrer_host?: string | null; step: FunnelStep }[],
): ReferrerConversionItem[] {
  const hostBySession = new Map<string, string>()
  for (const { session_id, referrer_host } of events) {
    if (!hostBySession.has(session_id)) hostBySession.set(session_id, referrer_host || 'direct')
  }
  const confirmedSessions = new Set(events.filter(e => e.step === 'confirmation').map(e => e.session_id))

  const sessionsByHost = new Map<string, number>()
  const conversionsByHost = new Map<string, number>()
  for (const [sessionId, host] of hostBySession) {
    sessionsByHost.set(host, (sessionsByHost.get(host) ?? 0) + 1)
    if (confirmedSessions.has(sessionId)) conversionsByHost.set(host, (conversionsByHost.get(host) ?? 0) + 1)
  }

  return [...sessionsByHost.entries()]
    .map(([host, sessions]) => {
      const conversions = conversionsByHost.get(host) ?? 0
      return { host, sessions, conversions, conversionRate: sessions > 0 ? Math.round((conversions / sessions) * 100) : 0 }
    })
    .sort((a, b) => b.sessions - a.sessions)
}

const WEEKDAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

/** Classe une heure (0-23, heure de Paris) en créneau lisible (pure). Reste
 *  volontairement simple — 4 créneaux, pas de heatmap heure par heure. */
function slotForHour(hour: number): string {
  if (hour < 6) return 'Nuit (0h-6h)'
  if (hour < 12) return 'Matin (6h-12h)'
  if (hour < 18) return 'Après-midi (12h-18h)'
  return 'Soir (18h-0h)'
}

export type VisitTimingItem = { label: string; sessions: number; pct: number }

export type VisitTimingBreakdown = {
  /** Dans l'ordre chronologique (Lundi -> Dimanche), pas trié par volume. */
  byWeekday: VisitTimingItem[]
  bySlot: VisitTimingItem[]
  topWeekday: string | null
  topSlot: string | null
}

/** Répartit les visites (une par session, à l'heure de son premier événement)
 *  par jour de semaine et par créneau horaire, en heure de Paris — cohérent
 *  avec le reste du code qui affiche des horaires client (voir
 *  api/bookings/route.ts). Une session qui revient sur plusieurs jours n'est
 *  comptée qu'une fois, sur son premier événement. */
export function buildVisitTimingBreakdown(events: { session_id: string; created_at: string }[]): VisitTimingBreakdown {
  const firstSeenBySession = new Map<string, number>()
  for (const { session_id, created_at } of events) {
    const t = new Date(created_at).getTime()
    const existing = firstSeenBySession.get(session_id)
    if (existing === undefined || t < existing) firstSeenBySession.set(session_id, t)
  }

  const formatter = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', hour: 'numeric', hourCycle: 'h23' })
  const weekdayCounts = new Map<string, number>()
  const slotCounts = new Map<string, number>()

  for (const t of firstSeenBySession.values()) {
    const parts = formatter.formatToParts(new Date(t))
    const weekdayRaw = parts.find(p => p.type === 'weekday')?.value ?? ''
    const weekday = weekdayRaw.charAt(0).toUpperCase() + weekdayRaw.slice(1)
    const hour = Number(parts.find(p => p.type === 'hour')?.value ?? '0')
    weekdayCounts.set(weekday, (weekdayCounts.get(weekday) ?? 0) + 1)
    const slot = slotForHour(hour)
    slotCounts.set(slot, (slotCounts.get(slot) ?? 0) + 1)
  }

  const total = firstSeenBySession.size

  const byWeekday = WEEKDAY_LABELS.map(label => {
    const sessions = weekdayCounts.get(label) ?? 0
    return { label, sessions, pct: total > 0 ? Math.round((sessions / total) * 100) : 0 }
  })

  const bySlot = [...slotCounts.entries()]
    .map(([label, sessions]) => ({ label, sessions, pct: total > 0 ? Math.round((sessions / total) * 100) : 0 }))
    .sort((a, b) => b.sessions - a.sessions)

  const topWeekday = byWeekday.reduce<VisitTimingItem | null>((best, item) => (
    item.sessions > 0 && (!best || item.sessions > best.sessions) ? item : best
  ), null)?.label ?? null

  const topSlot = bySlot[0] && bySlot[0].sessions > 0 ? bySlot[0].label : null

  return { byWeekday, bySlot, topWeekday, topSlot }
}

export type PeriodChange = {
  pct: number | null
  /** "new" : la période précédente était à zéro, aucun pourcentage défini. */
  direction: 'up' | 'down' | 'flat' | 'new'
}

/** Compare un compteur (ex. nombre de visiteurs) entre deux périodes de même
 *  durée (pure). Ne calcule pas de pourcentage quand la période précédente
 *  est à zéro (division par zéro non définie) : on le signale plutôt que
 *  d'afficher un "+Infinity%" ou un 0% trompeur. */
export function comparePeriods(current: number, previous: number): PeriodChange {
  if (previous === 0) {
    return { pct: null, direction: current > 0 ? 'new' : 'flat' }
  }
  const pct = Math.round(((current - previous) / previous) * 100)
  return { pct, direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' }
}

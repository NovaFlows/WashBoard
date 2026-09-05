// Validation serveur du moment choisi pour une réservation.
//
// Le formulaire public ne propose que des créneaux légitimes : jours J+1 à
// J+14, horaires d'ouverture du laveur, pas de chevauchement. Mais la route
// `POST /api/bookings` acceptait n'importe quel `scheduled_at` bien formé —
// une requête directe créait un rendez-vous à 3h du matin un dimanche de
// fermeture, ou daté de l'an dernier, ou dans trois ans. Le laveur le
// découvrait dans son agenda. Signalé par un audit externe le 2026-09-05.
//
// Ces fonctions rejouent côté serveur les règles de `StepSlot`, sans I/O, pour
// rester testables. Elles ne s'appliquent PAS au laveur qui saisit lui-même un
// rendez-vous depuis son tableau de bord : lui a le droit de forcer.

import { SLOT_STEP } from './slots'

/** Nombre de jours proposés par le formulaire, à partir de demain. */
export const BOOKING_HORIZON_DAYS = 14

export type VerdictDate = 'ok' | 'invalide' | 'passe' | 'trop_loin'

/** Le rendez-vous tombe-t-il dans la fenêtre réservable ?
 *
 *  Bornes volontairement exprimées en instants, pas en jours calendaires : un
 *  client qui ouvre la page à 23h59 voit les jours J+1..J+14, et son envoi peut
 *  arriver après minuit. Un décompte en jours locaux rejetterait alors sa
 *  réservation sans qu'il ait rien fait de mal. On tolère donc un jour de plus
 *  sur la borne haute, et on ne refuse en bas que ce qui est réellement passé. */
export function verdictDate(
  scheduledAt: string,
  nowMs: number = Date.now(),
  horizonDays: number = BOOKING_HORIZON_DAYS,
): VerdictDate {
  const t = new Date(scheduledAt).getTime()
  if (!Number.isFinite(t)) return 'invalide'
  if (t <= nowMs) return 'passe'
  if (t > nowMs + (horizonDays + 1) * 24 * 60 * 60_000) return 'trop_loin'
  return 'ok'
}

/** Jour de la semaine (0 = dimanche) et minutes écoulées depuis minuit, lus à
 *  l'heure de Paris.
 *
 *  Les horaires d'ouverture sont stockés en heure locale française, sans fuseau.
 *  Le serveur, lui, tourne en UTC sur Vercel : comparer directement donnerait
 *  une à deux heures d'écart selon la saison, et l'écart change au changement
 *  d'heure — un créneau de 8h passerait l'hiver et échouerait l'été. */
export function heureParis(scheduledAt: string): { jour: number; minutes: number } | null {
  const d = new Date(scheduledAt)
  if (!Number.isFinite(d.getTime())) return null

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)

  const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''
  const jours = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const jour = jours.indexOf(get('weekday'))
  // `hour12: false` rend minuit « 24 » dans certains environnements.
  const h = Number(get('hour')) % 24
  const m = Number(get('minute'))

  if (jour < 0 || !Number.isFinite(h) || !Number.isFinite(m)) return null
  return { jour, minutes: h * 60 + m }
}

export type PlageOuverture = { day_of_week: number; start_time: string; end_time: string }

/** "08:30" → 510. Renvoie `null` si le format est inattendu. */
function enMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm))
  if (!m) return null
  const h = Number(m[1]); const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

/** Le créneau démarre-t-il sur une ouverture du laveur, et la prestation
 *  tient-elle avant la fermeture ?
 *
 *  L'alignement sur le pas de 30 minutes est vérifié aussi : c'est exactement
 *  ce que `generateSlots` propose au client. Sans lui, on pourrait glisser un
 *  rendez-vous dans un interstice que l'interface ne montre jamais, et le
 *  calendrier du laveur afficherait des horaires bâtards.
 *
 *  Aucune plage enregistrée = laveur qui n'a pas encore saisi ses horaires : on
 *  laisse passer, sinon on bloquerait la réservation d'un compte tout neuf. */
export function creneauDansOuverture(
  scheduledAt: string,
  dureeMinutes: number,
  plages: PlageOuverture[],
  pas: number = SLOT_STEP,
): boolean {
  if (!plages || plages.length === 0) return true

  const local = heureParis(scheduledAt)
  if (!local) return false

  return plages.some(p => {
    if (Number(p.day_of_week) !== local.jour) return false
    const debut = enMinutes(p.start_time)
    const fin   = enMinutes(p.end_time)
    if (debut === null || fin === null) return false
    if (local.minutes < debut) return false
    if (local.minutes + dureeMinutes > fin) return false
    return (local.minutes - debut) % pas === 0
  })
}

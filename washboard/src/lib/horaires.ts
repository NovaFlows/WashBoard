// Logique de l'écran « Horaires » de la PWA (refonte 2026, `HorairesV2`) : lecture
// des plages d'ouverture, phrase de résumé, contrôles faits AVANT l'envoi.
//
// Convention à ne jamais changer : en base, `day_of_week` vaut 0 pour DIMANCHE
// (comme `Date.getDay()`), et `start_time` / `end_time` sont des heures locales
// « HH:MM » sans fuseau, lues en heure de Paris côté serveur (`heureParis`,
// `creneauDansOuverture`). On les affiche donc brutes, jamais via `new Date`.
//
// Deux règles ci-dessous n'existent PAS côté serveur ni dans l'écran du site
// (`admin/DisponibilitesManager.tsx`, inchangé) — c'est un durcissement propre à
// cet écran : deux plages qui se recouvrent sont refusées (`plageEnConflit`),
// parce que `StepSlot` génère les créneaux de chaque plage sans dédoublonner
// (`flatMap`) et proposerait le même horaire deux fois.

import { enMinutes } from '@/lib/bookingWindow'
import type { Availability, Unavailability } from '@/types'

export type Plage = Pick<Availability, 'day_of_week' | 'start_time' | 'end_time'>

/** Ordre d'affichage : lundi → dimanche. La base garde dimanche = 0. */
export const JOURS_AFFICHES = [1, 2, 3, 4, 5, 6, 0] as const

/** Indexés par `day_of_week` (0 = dimanche). */
export const NOMS_JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'] as const
export const NOMS_COURTS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'] as const

export const FERME = 'Fermé'
export const ERREUR_FIN_AVANT_DEBUT = 'L’heure de fin doit être après l’heure de début'

/** Pas des heures proposées : celui que le serveur impose (`horaireAligne`, 30 min). */
const PAS_MINUTES = 30

/** 00:00, 00:30 … 23:30 — les valeurs des deux listes déroulantes. */
export const HEURES_CHOIX: string[] = Array.from({ length: (24 * 60) / PAS_MINUTES }, (_, i) => {
  const minutes = i * PAS_MINUTES
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
})

/** « 08:00 » → « 8h », « 17:30 » → « 17h30 ». Accepte aussi « 08:00:00 » (type
 *  `time` de Postgres). Un format illisible est rendu tel quel plutôt que caché. */
export function heureCourte(hhmm: string): string {
  const m = enMinutes(hhmm)
  if (m === null) return String(hhmm)
  const h = Math.floor(m / 60)
  const min = m % 60
  return min === 0 ? `${h}h` : `${h}h${String(min).padStart(2, '0')}`
}

/** « 8h–12h ». */
export function libellePlage(p: Pick<Plage, 'start_time' | 'end_time'>): string {
  return `${heureCourte(p.start_time)}–${heureCourte(p.end_time)}`
}

/** Jours dans l'ordre d'affichage (lundi d'abord), sans doublon. */
export function trierJours(jours: number[]): number[] {
  return JOURS_AFFICHES.filter(j => jours.includes(j))
}

/** Les plages d'un jour, de la plus tôt à la plus tard. */
export function plagesDuJour<T extends Plage>(plages: T[], jour: number): T[] {
  return plages
    .filter(p => Number(p.day_of_week) === jour)
    .sort((a, b) => (enMinutes(a.start_time) ?? Infinity) - (enMinutes(b.start_time) ?? Infinity))
}

/** « 8h–12h · 14h–18h », ou « Fermé ». Jamais « Indisponible » : ce mot-là
 *  désigne les congés (`unavailabilities`) dans l'agenda. */
export function libelleJour(plages: Plage[], jour: number): string {
  const duJour = plagesDuJour(plages, jour)
  return duJour.length === 0 ? FERME : duJour.map(libellePlage).join(' · ')
}

/** « Lun–Ven 8h–18h · Sam 9h–12h ». Les jours CONSÉCUTIFS (dans l'ordre lundi →
 *  dimanche) qui ont exactement les mêmes plages sont regroupés ; un jour fermé
 *  interrompt la série. */
export function resumeHoraires(plages: Plage[]): string {
  type Groupe = { premier: number; dernier: number; plages: string; rang: number }
  const groupes: Groupe[] = []
  JOURS_AFFICHES.forEach((jour, rang) => {
    const duJour = plagesDuJour(plages, jour)
    if (duJour.length === 0) return
    const signature = duJour.map(libellePlage).join(', ')
    const dernier = groupes[groupes.length - 1]
    if (dernier && dernier.plages === signature && dernier.rang === rang - 1) {
      dernier.dernier = jour
      dernier.rang = rang
    } else {
      groupes.push({ premier: jour, dernier: jour, plages: signature, rang })
    }
  })
  if (groupes.length === 0) return 'Aucun horaire'
  return groupes
    .map(g => `${NOMS_COURTS[g.premier]}${g.dernier === g.premier ? '' : `–${NOMS_COURTS[g.dernier]}`} ${g.plages}`)
    .join(' · ')
}

/** « lundi », « lundi et mardi », « lundi, mardi et mercredi ». */
export function listeJours(jours: number[]): string {
  const noms = trierJours(jours).map(j => NOMS_JOURS[j].toLowerCase())
  if (noms.length <= 1) return noms.join('')
  return `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`
}

/** Fin après début ? `null` si la plage est cohérente. */
export function erreurPlage(debut: string, fin: string): string | null {
  const d = enMinutes(debut)
  const f = enMinutes(fin)
  if (d === null || f === null || f <= d) return ERREUR_FIN_AVANT_DEBUT
  return null
}

type Bornes = { start_time: string; end_time: string }

/** Deux plages qui se recouvrent vraiment (8–12 et 10–14). Deux plages qui se
 *  touchent (8–12 et 12–14) ne se recouvrent pas. */
export function seRecouvrent(a: Bornes, b: Bornes): boolean {
  const a0 = enMinutes(a.start_time); const a1 = enMinutes(a.end_time)
  const b0 = enMinutes(b.start_time); const b1 = enMinutes(b.end_time)
  if (a0 === null || a1 === null || b0 === null || b1 === null) return false
  return a0 < b1 && b0 < a1
}

/** La plage se termine pile là où l'autre commence, ou l'inverse. Ce n'est pas
 *  une erreur mais une conséquence à connaître : `generateSlots` découpe chaque
 *  plage séparément, donc une prestation ne peut pas passer de l'une à l'autre
 *  (avec 8–12 et 12–14, une prestation de 90 min ne démarre jamais à 11h). */
export function seTouchent(a: Bornes, b: Bornes): boolean {
  const a0 = enMinutes(a.start_time); const a1 = enMinutes(a.end_time)
  const b0 = enMinutes(b.start_time); const b1 = enMinutes(b.end_time)
  if (a0 === null || a1 === null || b0 === null || b1 === null) return false
  return a1 === b0 || b1 === a0
}

export type AnalyseAjout = {
  /** Fin avant début : bloque l'envoi. */
  erreurHeures: string | null
  /** « Chevauche 8h–12h » (préfixé du jour quand plusieurs sont cochés) : bloque l'envoi. */
  conflits: string[]
  /** Plage qui touche une plage existante : information, ne bloque pas. */
  contacts: string[]
  /** Au moins un jour coché et rien qui bloque. */
  pret: boolean
}

/** Tout ce que l'écran contrôle avant d'envoyer une plage sur les jours cochés. */
export function analyserAjout(
  jours: number[], debut: string, fin: string, existantes: Plage[],
): AnalyseAjout {
  const erreurHeures = erreurPlage(debut, fin)
  const conflits: string[] = []
  const contacts: string[] = []
  if (!erreurHeures) {
    const nouvelle = { start_time: debut, end_time: fin }
    const plusieurs = jours.length > 1
    for (const jour of trierJours(jours)) {
      const duJour = plagesDuJour(existantes, jour)
      const recouvertes = duJour.filter(p => seRecouvrent(nouvelle, p))
      if (recouvertes.length > 0) {
        const phrase = `Chevauche ${recouvertes.map(libellePlage).join(', ')}`
        conflits.push(plusieurs ? `${NOMS_JOURS[jour]} : ${phrase.toLowerCase()}` : phrase)
        continue
      }
      for (const p of duJour.filter(x => seTouchent(nouvelle, x))) {
        // La limite commune : la fin de l'une, le début de l'autre.
        const limite = enMinutes(p.end_time) === enMinutes(debut) ? p.end_time : p.start_time
        const phrase = `Touche ${libellePlage(p)} : une prestation ne pourra pas enjamber ${heureCourte(limite)}. Pour une seule plage continue, retirez l’ancienne d’abord.`
        contacts.push(plusieurs ? `${NOMS_JOURS[jour]} : ${phrase.charAt(0).toLowerCase()}${phrase.slice(1)}` : phrase)
      }
    }
  }
  return { erreurHeures, conflits, contacts, pret: jours.length > 0 && !erreurHeures && conflits.length === 0 }
}

// ── Ajout de plusieurs jours d'un coup ───────────────────────────────────────

export type ResultatJour =
  | { jour: number; ok: true; plage: Availability }
  | { jour: number; ok: false; message: string }

/** La phrase qui dit, jour par jour, ce qui a été créé et ce qui a échoué. `null`
 *  si tout a réussi : un succès ne s'annonce jamais quand un seul jour a échoué,
 *  et l'inverse. */
export function phraseEchecAjout(resultats: ResultatJour[]): string | null {
  const echecs = resultats.filter((r): r is Extract<ResultatJour, { ok: false }> => !r.ok)
  if (echecs.length === 0) return null
  const reussis = resultats.filter(r => r.ok).map(r => r.jour)
  const messages = [...new Set(echecs.map(e => e.message))]
  return [
    reussis.length > 0 ? `Ajouté : ${listeJours(reussis)}.` : null,
    `Pas ajouté : ${listeJours(echecs.map(e => e.jour))}.`,
    ...messages,
  ].filter(Boolean).join(' ')
}

// ── Congés ───────────────────────────────────────────────────────────────────

/** Périodes en cours ou à venir, la plus proche d'abord. `aujourdhui` : « YYYY-MM-DD ». */
export function congesAVenir<T extends Pick<Unavailability, 'start_date' | 'end_date'>>(conges: T[], aujourdhui: string): T[] {
  return conges
    .filter(c => c.end_date >= aujourdhui)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
}

export const ERREUR_DATES_MANQUANTES = 'Choisissez la date de début et la date de fin.'
export const ERREUR_FIN_DATE_AVANT_DEBUT = 'La date de fin doit être après la date de début'

/** Contrôle de la feuille « Bloquer une période », avant l'envoi : sans lui, une
 *  fin antérieure au début est refusée par le serveur (« Dates invalides ») et
 *  `useConges.saveUnavail` ne montre alors rien du tout. Un même jour de début et
 *  de fin est valide (un seul jour bloqué). */
export function erreurPeriode(debut: string, fin: string): string | null {
  if (!debut || !fin) return ERREUR_DATES_MANQUANTES
  if (fin < debut) return ERREUR_FIN_DATE_AVANT_DEBUT
  return null
}

// ── Un seul appel à la fois ──────────────────────────────────────────────────

/** Enveloppe une action asynchrone : tant qu'un appel est en cours, les suivants
 *  sont ignorés (rendent `null`). Un double tap sur « Lun–Ven 8h–18h » lancerait
 *  sinon deux séries de cinq POST, donc dix plages dont cinq en double — l'état
 *  d'un bouton (`disabled`) n'est relu qu'au rendu suivant, un second tap peut le
 *  précéder. */
export function unSeulALaFois<A extends unknown[], R>(
  action: (...args: A) => Promise<R>,
): (...args: A) => Promise<R | null> {
  let enCours = false
  return async (...args: A) => {
    if (enCours) return null
    enCours = true
    try {
      return await action(...args)
    } finally {
      enCours = false
    }
  }
}

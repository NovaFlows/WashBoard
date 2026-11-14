// Rappels de rendez-vous par email (2026-11-14), à la demande de prospects : « 1 h avant, ou 3 h
// avant, un mail de rappel : certains oublient vite, ça permet de rappeler ».
//
// Email SEULEMENT, et allumé par défaut : un email ne coûte rien, contrairement au SMS (quota,
// crédits Brevo). Le laveur peut le couper, choisir combien de rappels partent (1 à 3) et combien
// d'heures avant le rendez-vous chacun part.
//
// Ce fichier est du calcul pur, sans requête : le cron (`api/cron/rappels-rdv`) et l'écran
// « Messages automatiques » s'en servent tous les deux, donc ils disent la même chose.

/** Le laveur qui n'a rien réglé : un rappel la veille, un autre 3 h avant. */
export const RAPPEL_HEURES_DEFAUT: readonly number[] = [24, 3]
/** Combien de rappels au plus par rendez-vous. Au-delà, ça devient du harcèlement. */
export const RAPPEL_NB_MAX = 3
/** Le plus tôt qu'un rappel peut partir : une semaine avant. */
export const RAPPEL_HEURES_MAX = 168

const HEURE = 3_600_000

/** Ramène ce qui arrive du navigateur ou de la base à une liste propre : entiers entre 1 et
 *  `RAPPEL_HEURES_MAX`, sans doublon, du plus lointain au plus proche, `RAPPEL_NB_MAX` au plus.
 *  Ce qui n'est pas une liste (colonne absente, `null`) vaut « pas réglé » : les valeurs par défaut. */
export function normaliserHeures(brut: unknown): number[] {
  if (!Array.isArray(brut)) return [...RAPPEL_HEURES_DEFAUT]
  const heures = new Set<number>()
  for (const v of brut) {
    const n = Math.floor(Number(v))
    if (Number.isFinite(n) && n >= 1 && n <= RAPPEL_HEURES_MAX) heures.add(n)
  }
  return [...heures].sort((a, b) => b - a).slice(0, RAPPEL_NB_MAX)
}

/** Les rappels sont-ils en marche ? Absent (colonne pas encore créée) ou `null` : oui, c'est le
 *  réglage par défaut. Seul un `false` explicite les coupe. */
export const rappelsActifs = (actif: unknown): boolean => actif !== false

/** « 24 h avant », « 1 jour avant », « 2 jours avant ». */
export function libelleHeuresAvant(h: number): string {
  if (h % 24 === 0) return `${h / 24} jour${h / 24 > 1 ? 's' : ''} avant`
  return `${h} h avant`
}

/** Résumé en une ligne : « 24 h avant et 3 h avant », « 1 jour avant ». */
export function resumeRappels(heures: number[]): string {
  if (heures.length === 0) return 'Aucun délai choisi'
  return heures.map(libelleHeuresAvant).join(' · ')
}

/** Rappels à envoyer MAINTENANT pour un rendez-vous : ceux dont l'heure est venue, pas encore
 *  partis, et qui avaient encore un sens quand le rendez-vous a été pris.
 *
 *  Un rendez-vous pris à 10 h pour 14 h n'a pas à recevoir un rappel « 24 h avant » : cette heure
 *  était passée avant même qu'il existe. Un rendez-vous déjà commencé n'en reçoit plus. */
export function rappelsDus(p: {
  rdvLe: string
  creeLe: string
  heures: number[]
  deja: number[]
  maintenant: number
}): number[] {
  const rdv = Date.parse(p.rdvLe)
  const cree = Date.parse(p.creeLe)
  if (!Number.isFinite(rdv) || p.maintenant >= rdv) return []
  return p.heures.filter(h => {
    if (p.deja.includes(h)) return false
    const depart = rdv - h * HEURE
    if (p.maintenant < depart) return false
    // `creeLe` illisible : on ne bloque pas le rappel pour autant.
    return !Number.isFinite(cree) || cree <= depart
  })
}

/** Ce que le cron lit sur `bookings.rappels_rdv_envoyes` : une liste d'heures, sinon rien. */
export function heuresEnvoyees(brut: unknown): number[] {
  return Array.isArray(brut) ? brut.map(Number).filter(Number.isFinite) : []
}

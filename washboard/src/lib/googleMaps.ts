import { logger } from '@/lib/logger'

// Accès unique aux API Google Maps côté serveur.
//
// Deux problèmes réglés ici, tous les deux vécus en production :
//
// 1. La clé était lue directement dans six fichiers sous le nom
//    `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. Ce préfixe est trompeur : la clé ne
//    sert que côté serveur, et le jour où quelqu'un la référence dans un
//    composant client, Next l'inline dans le bundle du navigateur.
//
// 2. Les appels renvoyaient un JSON dont personne ne regardait le `status`.
//    Le 2026-08-26, la facturation Google était désactivée : toutes les
//    requêtes répondaient `REQUEST_DENIED`, et l'application se comportait
//    simplement comme s'il n'y avait aucun résultat — autocomplétion vide,
//    frais de déplacement à 0, zones acceptées par défaut. Aucune trace.

/**
 * Clé Maps. On lit d'abord le nouveau nom, puis l'ancien : le renommage peut
 * ainsi être déployé avant que la variable soit renommée côté Vercel, sans
 * casser la production entre les deux.
 */
export function getMapsApiKey(): string | undefined {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
}

/** Statuts Google qui signalent un résultat vide, pas une panne. */
const STATUTS_NORMAUX = new Set(['OK', 'ZERO_RESULTS'])

/**
 * Appelle une API Google Maps et trace les vraies pannes.
 *
 * Renvoie `null` en cas d'échec — l'appelant reste libre de choisir son
 * comportement de repli, mais la panne, elle, est désormais visible.
 *
 * @param event  Nom d'événement pour les logs (ex. « places.autocomplete »).
 */
export async function fetchGoogleMaps<T extends { status?: string; error_message?: string }>(
  url: string,
  event: string,
): Promise<T | null> {
  const key = getMapsApiKey()
  if (!key) {
    logger.error(`${event}.no_api_key`, {})
    return null
  }

  try {
    const res = await fetch(`${url}&key=${key}`)
    const data = (await res.json()) as T

    if (data.status && !STATUTS_NORMAUX.has(data.status)) {
      // REQUEST_DENIED (facturation, restrictions de clé), OVER_QUERY_LIMIT,
      // INVALID_REQUEST… : ce sont des pannes, pas des absences de résultat.
      logger.error(`${event}.google_error`, {
        status: data.status,
        message: data.error_message ?? null,
      })
      return null
    }

    return data
  } catch (e) {
    logger.error(`${event}.fetch_failed`, {}, e)
    return null
  }
}

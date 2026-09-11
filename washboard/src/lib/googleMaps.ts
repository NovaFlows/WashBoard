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
 * Clé Maps, sous son seul nom : `GOOGLE_MAPS_API_KEY`.
 *
 * Le repli sur l'ancien `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` a servi le temps du
 * renommage côté Vercel. Il a été retiré le 2026-09-11, une fois que
 * `/api/health` a confirmé en production la présence du nouveau nom.
 */
export function getMapsApiKey(): string | undefined {
  return process.env.GOOGLE_MAPS_API_KEY || undefined
}

/**
 * Sous quel nom la clé est-elle présente — sans jamais révéler sa valeur.
 *
 * Exposé par `/api/health`. C'est ce contrôle qui a permis de retirer sans
 * risque le repli sur l'ancien nom : une variable renommée ne sert qu'après un
 * redéploiement, et rien d'autre ne le prouvait de l'extérieur.
 *
 * Depuis ce retrait, « ancien-nom-seulement » signifie que la clé n'est PAS
 * utilisée : elle existe, mais sous un nom que le code ne lit plus. C'est la
 * cause la plus directe d'une autocomplétion muette, lisible ici en une requête.
 */
export function etatCleMaps(): 'presente' | 'ancien-nom-seulement' | 'absente' {
  if (process.env.GOOGLE_MAPS_API_KEY) return 'presente'
  if (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) return 'ancien-nom-seulement'
  return 'absente'
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

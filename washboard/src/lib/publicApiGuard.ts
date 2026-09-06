import { NextResponse } from 'next/server'
import { rateLimit, cleanupRateLimit, clientIp } from './rateLimit'
import { logger } from './logger'

// Plafond des routes publiques qui coûtent de l'argent à chaque appel.
//
// Cinq routes appellent Google Maps sans authentification : autocomplétion
// d'adresse, détail d'un lieu, contrôle de zone, frais de déplacement et
// créneaux optimisés. Google facture à l'appel. Aucune ne comptait ses
// requêtes : trois lignes de script suffisaient à enchaîner des milliers
// d'appels par minute, et donc soit à faire grimper la facture, soit à épuiser
// le quota — auquel cas la saisie d'adresse cesse de fonctionner pour tout le
// monde, y compris les clients des laveurs. Relevé lors de la revue du
// 2026-09-06.
//
// UN SEUL COMPTEUR pour les cinq : ce qu'on protège, c'est le budget Maps, pas
// chaque URL prise séparément. Répartir le plafond route par route laisserait
// un script tourner cinq fois plus longtemps.

/** Généreux à dessein.
 *
 *  Un parcours de réservation complet consomme une trentaine d'appels. Le
 *  plafond en laisse donc passer une dizaine par tranche de dix minutes et par
 *  adresse IP — alors qu'un script en réclame des milliers par minute.
 *
 *  Cette marge n'est pas du confort : les opérateurs mobiles font passer des
 *  centaines d'abonnés derrière une même adresse IP. Un plafond serré
 *  refuserait de vraies réservations sans que personne ne comprenne pourquoi,
 *  exactement comme le comptage des visites qui sous-estimait les statistiques
 *  d'un laveur jusqu'à ce qu'on en trouve la cause. */
export const MAPS_LIMITE = 300
export const MAPS_FENETRE_MS = 10 * 60 * 1000

type RequeteLisible = { headers: { get(nom: string): string | null } }

/** Renvoie la réponse 429 à retourner telle quelle, ou `null` si l'appel passe. */
export function refusSiQuotaMapsDepasse(req: RequeteLisible): NextResponse | null {
  cleanupRateLimit()
  const ip = clientIp(req)
  const verdict = rateLimit(`maps:${ip}`, MAPS_LIMITE, MAPS_FENETRE_MS)
  if (verdict.ok) return null

  // Tracé : au volume actuel, franchir ce plafond est soit un abus, soit le
  // signe que la marge est trop juste. Les deux méritent d'être vus.
  logger.warn('maps.rate_limited', { ip })

  return NextResponse.json(
    { error: 'Trop de requêtes en peu de temps. Réessayez dans quelques minutes.' },
    { status: 429, headers: { 'Retry-After': String(verdict.retryAfter) } },
  )
}

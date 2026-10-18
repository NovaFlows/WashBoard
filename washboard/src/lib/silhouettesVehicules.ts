// Véhicules de la page de réservation (demandes d'Alexandre, 2026-10-18 : au choix du véhicule,
// il apparaît avec une rotation 3D à 360° comme la carte de fidélité). D'abord des silhouettes
// dessinées, jugées « trop enfantines » ; puis « on ne fait plus les silhouettes, on essaie avec
// les voitures segmentées » : la vraie voiture, détourée des photos qu'il a choisies ; enfin
// « toutes les voitures sélectionnées dans ce type de forme grise », celle de l'image d'attente :
// chaque voiture passe en gris clair, toutes du même ton.
//
// Une image WebP transparente par type (public/silhouettes/), chargée seulement pour le véhicule
// choisi : 30 à 50 Ko chacune. Toutes dans le même cadre 1040 × 420, roues sur la même ligne,
// avant à droite (scripts/silhouettes/decoupe.py).
//
// Seuls les types qui ont une photo en ont une ; les autres (moto, camping-car… en attente de
// photos) et les types personnalisés par le laveur (« Canapé », etc.) n'affichent rien :
// `silhouettePour` rend `null`.

export const TYPES_AVEC_SILHOUETTE = [
  'citadine', 'citadine_2p', 'berline', 'SUV', 'monospace', '7places', 'utilitaire',
] as const

/** À changer quand les fichiers changent : les navigateurs gardent les anciens en cache. */
const VERSION = '2026-10-18d'

/** L'image du véhicule d'un type, ou `null` s'il n'en a pas. */
export function silhouettePour(type: string | null | undefined): string | null {
  if (!type || !(TYPES_AVEC_SILHOUETTE as readonly string[]).includes(type)) return null
  return `/silhouettes/${encodeURIComponent(type)}.webp?v=${VERSION}`
}

// Silhouettes de véhicules de la page de réservation (demandes d'Alexandre, 2026-10-18 :
// « une forme segmentée du modèle apparaît » au choix du véhicule, avec une rotation 3D à
// 360° comme la carte de fidélité ; puis « plus détaillées », tirées de photos qu'il a choisies).
//
// Ce sont des fichiers SVG statiques (public/silhouettes/), chargés seulement pour le véhicule
// choisi — pas des tracés embarqués dans le code de la page : une silhouette détaillée pèse de
// 13 à 25 Ko. Pour chaque type :
//   <type>.svg          la face : contour blanc, carrosserie, vitres, roues
//   <type>-contour.svg  la seule forme, pour la tranche 3D et les masques du reflet
// Les voitures sont tirées de photos (scripts/silhouettes/decoupe.py puis vectorise.py) ; les
// véhicules sans photo sont dessinés à la main (scripts/silhouettes/export-dessinees.mjs).
//
// Une clé par type de `VEHICLE_LABELS` (lib/vehicle-labels.ts). Un type personnalisé par le
// laveur (catégorie « Canapé », etc.) n'a pas de silhouette : `silhouettePour` rend `null`.

export const TYPES_AVEC_SILHOUETTE = [
  'citadine', 'citadine_2p', 'berline', 'SUV', 'monospace', '7places', 'utilitaire',
  'camping-car', 'camion', 'moto', 'scooter', 'velo',
] as const

/** À changer quand les fichiers changent : les navigateurs gardent les anciens en cache. */
const VERSION = '2026-10-18b'

export type Silhouette = { face: string; contour: string }

/** Les fichiers de la silhouette d'un type de véhicule, ou `null` s'il n'en a pas. */
export function silhouettePour(type: string | null | undefined): Silhouette | null {
  if (!type || !(TYPES_AVEC_SILHOUETTE as readonly string[]).includes(type)) return null
  const base = `/silhouettes/${encodeURIComponent(type)}`
  return { face: `${base}.svg?v=${VERSION}`, contour: `${base}-contour.svg?v=${VERSION}` }
}

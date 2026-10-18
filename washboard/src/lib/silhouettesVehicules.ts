// Véhicules de la page de réservation (demandes d'Alexandre, 2026-10-18 : au choix du véhicule,
// il apparaît avec une rotation 3D à 360° comme la carte de fidélité). D'abord des silhouettes
// dessinées, jugées « trop enfantines » ; puis « on ne fait plus les silhouettes, on essaie avec
// les voitures segmentées » : la vraie voiture, détourée des photos qu'il a choisies ; enfin
// « toutes les voitures sélectionnées dans ce type de forme grise », celle de l'image d'attente :
// chaque voiture passe en gris très pâle, toutes du même ton, exactement comme l'image d'attente.
//
// Une image WebP transparente par type (public/silhouettes/), chargée seulement pour le véhicule
// choisi : 15 à 25 Ko chacune. Toutes dans le même cadre 1040 × 420, roues sur la même ligne,
// avant à droite (scripts/silhouettes/decoupe.py).
//
// Le type se reconnaît à son identifiant (« moto », celui des modèles de catégorie) ou, à
// défaut, à son nom : un type ajouté à la main dans une catégorie reçoit un identifiant au
// hasard (FeuilleCategorieV2), et la « Moto » qu'Alexandre avait ajoutée ainsi n'affichait rien
// (2026-10-19). Le scooter et le vélo restent sans image (décision d'Alexandre, 2026-10-19), comme
// les types sans rapport (« Canapé ») : `silhouettePour` rend `null`.

import { VEHICLE_LABELS } from './vehicle-labels'

export const TYPES_AVEC_SILHOUETTE = [
  'citadine', 'citadine_2p', 'berline', 'SUV', 'monospace', '7places', 'utilitaire',
  'moto', 'camion', 'camping-car', // ajoutés le 2026-10-19, photos d'Alexandre
] as const
type TypeAvecImage = (typeof TYPES_AVEC_SILHOUETTE)[number]

/** À changer quand les fichiers changent : les navigateurs gardent les anciens en cache. */
const VERSION = '2026-10-19b'

/** « Van / Utilitaire » → « van utilitaire » : minuscules, sans accents ni ponctuation. */
const normaliser = (nom: string) =>
  nom.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** Les noms qu'un laveur donne à ces véhicules, en plus de leurs libellés dans l'app. */
const PAR_NOM = new Map<string, TypeAvecImage>([
  ...TYPES_AVEC_SILHOUETTE.map(t => [normaliser(VEHICLE_LABELS[t]), t] as const),
  ['citadines', 'citadine'],
  ['citadine 2 places', 'citadine_2p'], ['citadine 2 portes', 'citadine_2p'],
  ['berlines', 'berline'],
  ['suv', 'SUV'], ['4x4', 'SUV'], ['suvs', 'SUV'],
  ['monospaces', 'monospace'],
  ['7places', '7places'], ['sept places', '7places'],
  ['van', 'utilitaire'], ['vans', 'utilitaire'], ['utilitaire', 'utilitaire'], ['utilitaires', 'utilitaire'],
  ['fourgon', 'utilitaire'], ['fourgonnette', 'utilitaire'], ['camionnette', 'utilitaire'],
  ['motos', 'moto'],
  ['camions', 'camion'], ['poids lourd', 'camion'], ['poids lourds', 'camion'],
  ['camping cars', 'camping-car'], ['campingcar', 'camping-car'], ['camping', 'camping-car'],
  ['fourgon amenage', 'camping-car'], ['van amenage', 'camping-car'], ['campervan', 'camping-car'],
])

/** L'image du véhicule d'un type, reconnu à son identifiant ou à son nom, ou `null`. */
export function silhouettePour(type: string | null | undefined, nom?: string | null): string | null {
  const connu = type && (TYPES_AVEC_SILHOUETTE as readonly string[]).includes(type)
    ? type
    : nom ? PAR_NOM.get(normaliser(nom)) : undefined
  if (!connu) return null
  return `/silhouettes/${encodeURIComponent(connu)}.webp?v=${VERSION}`
}

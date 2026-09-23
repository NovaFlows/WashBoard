// Choix de l'application d'itinéraire, selon le téléphone — accueil v2 de la
// PWA (bouton « Itinéraire » du prochain rendez-vous).
//
// Demande d'Alexandre, 2026-09-24 : proposer Plans, Waze ou Google Maps « en
// fonction du téléphone, donc pas de Plans pour les Android ». Plans (Apple)
// n'existe que sur iPhone et iPad ; Waze et Google Maps ouvrent leur
// application quand elle est installée, sinon leur version web.
//
// Uniquement des adresses universelles : aucune clé d'API, aucun
// géocodage, l'application choisie cherche elle-même l'adresse.

export type Plateforme = 'ios' | 'android' | 'autre'

export type ApplicationItineraire = { id: 'plans' | 'waze' | 'google'; nom: string; lien: string }

/**
 * `navigator.userAgent` ne suffit pas pour un iPad : depuis iPadOS 13 il se
 * présente comme un Mac (« MacIntel »). Un Mac avec écran tactile n'existe pas,
 * c'est donc le signe qu'on cherche.
 */
export function detecterPlateforme(
  userAgent: string,
  platform: string = '',
  maxTouchPoints: number = 0,
): Plateforme {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios'
  if (platform === 'MacIntel' && maxTouchPoints > 1) return 'ios'
  if (/Android/i.test(userAgent)) return 'android'
  return 'autre'
}

/** Les applications proposées, dans l'ordre où elles s'affichent. */
export function applicationsItineraire(adresse: string, plateforme: Plateforme): ApplicationItineraire[] {
  const q = encodeURIComponent(adresse)
  const plans: ApplicationItineraire = { id: 'plans', nom: 'Plans', lien: `https://maps.apple.com/?daddr=${q}&dirflg=d` }
  const waze: ApplicationItineraire = { id: 'waze', nom: 'Waze', lien: `https://waze.com/ul?q=${q}&navigate=yes` }
  const google: ApplicationItineraire = { id: 'google', nom: 'Google Maps', lien: `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving` }

  // Plans seulement sur iPhone et iPad. Sur Android comme sur ordinateur, il
  // ouvrirait une page web sans intérêt.
  if (plateforme === 'ios') return [plans, waze, google]
  return [google, waze]
}

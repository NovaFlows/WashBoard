export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R    = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a    = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Temps de trajet estimé entre deux points, à vitesse moyenne fixe de
 *  60 km/h sur une distance à vol d'oiseau (`haversineKm`) — pas un itinéraire
 *  réel (pas de routage), juste de quoi avertir qu'un enchaînement de
 *  rendez-vous est serré. Extrait de `CalendrierDashboard.tsx` (passe 7 de la
 *  refonte 2026), où cette formule existait déjà, dupliquée deux fois, pour
 *  l'avertissement de faisabilité d'un rendez-vous manuel — même calcul,
 *  maintenant réutilisé aussi par l'agenda du jour (v2) pour afficher le
 *  temps de route entre deux jobs. Comportement inchangé : mêmes chiffres
 *  qu'avant l'extraction. */
export function estimateTravelMinutes(km: number): number {
  return Math.round(km / 60 * 60)
}

// Sources de trafic pour lesquelles WashBoard génère un lien de réservation
// dédié (?utm_source=...), pour identifier fiablement l'origine d'un clic
// même quand le navigateur intégré de l'app (Instagram, TikTok) ne transmet
// aucun referrer — voir funnelTracking.ts (resolveReferrerHost).
//
// Source unique : la liste affichée (Réglages, CRM) et le mapping utilisé
// pour le tracking dérivent tous les deux de ce fichier.
export const TRAFFIC_SOURCES = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'tiktok',    label: 'TikTok' },
  { key: 'facebook',  label: 'Facebook' },
  { key: 'google',    label: 'Google (fiche établissement, avis)' },
] as const

export type TrafficSourceKey = typeof TRAFFIC_SOURCES[number]['key']

/** Host normalisé associé à chaque source — cohérent avec le format déjà
 *  utilisé pour les referrers réels (voir extractReferrerHost), pour que les
 *  deux origines d'un même canal se retrouvent dans le même regroupement. */
export const TRAFFIC_SOURCE_HOSTS: Record<TrafficSourceKey, string> = {
  instagram: 'instagram.com',
  tiktok:    'tiktok.com',
  facebook:  'facebook.com',
  google:    'google.com',
}

/** Construit le lien de réservation à partager pour une source donnée. */
export function buildTrackedBookingLink(baseUrl: string, sourceKey: TrafficSourceKey): string {
  return `${baseUrl}?utm_source=${sourceKey}`
}

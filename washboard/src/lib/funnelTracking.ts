// Tracking anonyme de l'entonnoir de réservation (voir migration 003 et
// POST /api/analytics/funnel). Logique pure et testable ici ; l'unique bout
// d'I/O navigateur (sessionStorage) est isolé dans getOrCreateSessionId.

import { TRAFFIC_SOURCE_HOSTS, type TrafficSourceKey } from '@/lib/trafficSources'

export type FunnelStep = 'prestation' | 'options' | 'creneau' | 'coordonnees' | 'confirmation'
export type Device = 'mobile' | 'tablet' | 'desktop'

const SESSION_STORAGE_KEY = 'wb_funnel_sid'
const CAMPAGNE_STORAGE_KEY = 'wb_utm_campaign'

/** Longueur au-delà de laquelle on ignore : une clé de campagne fait quarante
 *  caractères (voir campagne.ts). Plus long, c'est qu'on nous envoie autre
 *  chose — et cette valeur part en base. */
const CAMPAGNE_MAX = 64

/** Classe une largeur d'écran en catégorie d'appareil (pure, testable). */
export function detectDevice(width: number): Device {
  if (width < 640) return 'mobile'
  if (width < 1024) return 'tablet'
  return 'desktop'
}

/** Extrait le nom d'hôte d'un referrer, sauf s'il s'agit du même site (pure,
 *  testable) — on ne veut que "d'où vient le clic" (Google, Instagram, lien
 *  direct…), jamais l'URL complète (peut contenir des paramètres sensibles). */
export function extractReferrerHost(referrer: string, currentHost: string): string | undefined {
  if (!referrer) return undefined
  try {
    const host = new URL(referrer).host
    return host && host !== currentHost ? host : undefined
  } catch {
    return undefined
  }
}

/** Détermine la source de trafic à enregistrer (pure, testable).
 *
 *  Priorité au paramètre `?utm_source=...` des liens dédiés générés par
 *  WashBoard (Réglages, CRM) : fiable, il vient du lien lui-même, pas du
 *  navigateur. Le `document.referrer` reste le repli pour tout le reste
 *  (Google, un site qui pointe vers le laveur…), mais Instagram et TikTok
 *  ont un historique connu de navigateurs intégrés qui ne le transmettent
 *  pas — sans lien dédié, ces visites retombent alors sur "Accès direct". */
export function resolveReferrerHost(referrer: string, currentHost: string, search: string): string | undefined {
  const utmSource = new URLSearchParams(search).get('utm_source')?.toLowerCase() as TrafficSourceKey | null
  if (utmSource && utmSource in TRAFFIC_SOURCE_HOSTS) return TRAFFIC_SOURCE_HOSTS[utmSource]
  return extractReferrerHost(referrer, currentHost)
}

/** La campagne portée par le lien (`?utm_campaign=...`), retenue le temps de
 *  la visite.
 *
 *  Retenue dans `sessionStorage`, comme l'identifiant de session, et pour la
 *  même raison : limitée à l'onglet, effacée à sa fermeture, aucun suivi d'une
 *  visite à l'autre. C'est ce qui dispense la page de réservation d'un bandeau
 *  de consentement — et un bandeau devant un formulaire de réservation coûte
 *  au laveur bien plus de clients qu'une statistique ne lui en rapporte.
 *
 *  Conséquence assumée : quelqu'un qui clique la publicité lundi, ferme, et
 *  revient réserver jeudi en direct n'est pas rattaché à la campagne. Elle est
 *  donc sous-estimée, jamais sur-estimée — le sens de l'erreur qui ne fait
 *  jamais prendre une mauvaise décision au laveur.
 *
 *  Nettoyée de ce qui n'a rien à faire dans une clé : la valeur arrive d'une
 *  URL publique, et finit en base. */
export function nettoyerCleCampagne(brut: string | null | undefined): string | undefined {
  if (!brut) return undefined
  const propre = brut.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, CAMPAGNE_MAX)
  return propre || undefined
}

/** Lit la campagne de l'URL, la retient, et la rend. Sans paramètre dans
 *  l'URL, rend celle déjà retenue pour cette visite — le laveur perdrait son
 *  attribution dès la deuxième étape du formulaire sans cette mémoire. */
export function resolveCampagne(search: string): string | undefined {
  const depuisUrl = nettoyerCleCampagne(new URLSearchParams(search).get('utm_campaign'))
  if (typeof window === 'undefined') return depuisUrl
  try {
    if (depuisUrl) {
      window.sessionStorage.setItem(CAMPAGNE_STORAGE_KEY, depuisUrl)
      return depuisUrl
    }
    return window.sessionStorage.getItem(CAMPAGNE_STORAGE_KEY) ?? undefined
  } catch {
    // Stockage refusé (navigation privée stricte, navigateurs intégrés) : on
    // se contente de l'URL. Pas de mesure plutôt qu'un parcours cassé.
    return depuisUrl
  }
}

/** Session anonyme limitée à l'onglet du navigateur : pas de cookie
 *  persistant, pas de suivi d'une visite à l'autre. Reset à chaque nouvel
 *  onglet/fermeture — volontaire, voir la note RGPD dans la migration 003. */
export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return ''
  // `sessionStorage` lève une exception, et ne renvoie pas simplement null,
  // quand le navigateur en interdit l'accès : navigation privée stricte,
  // réglage « bloquer les données de sites », et surtout les navigateurs
  // intégrés de TikTok ou Instagram — par où arrive une bonne part du trafic
  // des laveurs. Sans ce garde-fou, l'exception remontait jusqu'au composant
  // de réservation.
  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (existing) return existing
    const id = crypto.randomUUID()
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, id)
    return id
  } catch {
    // Stockage indisponible : pas de session, donc pas de mesure pour cette
    // visite. On préfère perdre une statistique qu'empêcher quelqu'un de
    // réserver.
    return ''
  }
}

/** Envoie un événement d'entonnoir, sans jamais faire échouer l'appelant :
 *  le tracking ne doit jamais casser le parcours de réservation. */
export function trackFunnelStep(washerId: string, step: FunnelStep): void {
  if (typeof window === 'undefined') return
  const sessionId = getOrCreateSessionId()
  if (!sessionId) return
  const body = JSON.stringify({
    washer_id:     washerId,
    session_id:    sessionId,
    step,
    referrer_host: resolveReferrerHost(document.referrer, window.location.host, window.location.search),
    utm_campaign:  resolveCampagne(window.location.search),
    device:        detectDevice(window.innerWidth),
  })
  try {
    fetch('/api/analytics/funnel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true })
      .catch(() => {})
  } catch {
    // Pas de fetch dispo (contexte de test, ancien navigateur…) : on ignore.
  }
}

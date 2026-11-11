import { createHmac, timingSafeEqual } from 'node:crypto'

// Protéger les vidéos du partenaire (branche feat/formation, 2026-11-10).
//
// À LIRE AVANT DE PROMETTRE QUOI QUE CE SOIT AU PARTENAIRE : dans un navigateur, rien n'empêche
// physiquement une capture d'écran faite avec un autre appareil (un téléphone qui filme l'écran),
// ni, sans DRM matériel, une capture système. Ce qu'on peut faire, et que cette coquille met en
// place, c'est rendre le vol DÉCOURAGEANT et TRAÇABLE :
//   1. le lien de lecture est signé, lié à UN laveur et UNE leçon, et expire en quelques minutes ;
//   2. un filigrane au nom du laveur (e-mail + identifiant + heure) court sur la vidéo : une fuite
//      se retrouve à son auteur, et un laveur qui sait ça ne diffuse pas ;
//   3. la lecture se coupe quand l'onglet perd le focus ou que l'écran est partagé ;
//   4. pas de téléchargement, pas de clic droit, pas d'image dans la mémoire du navigateur.
// Le vrai verrou contre la capture d'écran est un fournisseur vidéo avec DRM (Widevine/FairPlay :
// l'écran reste noir en capture sur Safari et la plupart des navigateurs). Voir docs/FORMATION.md.

export const POLITIQUE_PROTECTION = {
  /** Durée de vie du lien de lecture. Court : il est redemandé toutes les 90 s par le lecteur. */
  dureeJetonSec: 120,
  /** Le lecteur redemande un jeton avant l'expiration. */
  renouvellementSec: 90,
  /** Nombre de lectures simultanées d'un même compte (un compte partagé en ouvre plusieurs). */
  lecturesSimultaneesMax: 1,
  /** Le filigrane change de place toutes les N secondes (un cache fixe se recadre). */
  deplacementFiligraneSec: 12,
} as const

type ParamsJeton = { userId: string; leconId: string; secret: string; maintenant?: Date; dureeSec?: number }

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64url')

/** `charge.signature`, où charge = base64url({u, l, e}) et signature = HMAC-SHA256 de la charge. */
export function signerJetonLecture({ userId, leconId, secret, maintenant = new Date(), dureeSec = POLITIQUE_PROTECTION.dureeJetonSec }: ParamsJeton): string {
  const exp = Math.floor(maintenant.getTime() / 1000) + dureeSec
  const charge = b64(JSON.stringify({ u: userId, l: leconId, e: exp }))
  const signature = createHmac('sha256', secret).update(charge).digest('base64url')
  return `${charge}.${signature}`
}

export type VerificationJeton =
  | { ok: true; userId: string; leconId: string; expireLe: number }
  | { ok: false; raison: 'forme' | 'signature' | 'expire' }

export function verifierJetonLecture(jeton: unknown, { secret, maintenant = new Date() }: { secret: string; maintenant?: Date }): VerificationJeton {
  if (typeof jeton !== 'string') return { ok: false, raison: 'forme' }
  const morceaux = jeton.split('.')
  if (morceaux.length !== 2 || !morceaux[0] || !morceaux[1]) return { ok: false, raison: 'forme' }
  const [charge, signature] = morceaux

  const attendue = createHmac('sha256', secret).update(charge).digest()
  let recue: Buffer
  try { recue = Buffer.from(signature, 'base64url') } catch { return { ok: false, raison: 'forme' } }
  // `timingSafeEqual` exige deux longueurs égales : une signature de mauvaise taille est refusée avant.
  if (recue.length !== attendue.length || !timingSafeEqual(recue, attendue)) return { ok: false, raison: 'signature' }

  let donnees: { u?: unknown; l?: unknown; e?: unknown }
  try { donnees = JSON.parse(Buffer.from(charge, 'base64url').toString('utf8')) } catch { return { ok: false, raison: 'forme' } }
  if (typeof donnees.u !== 'string' || typeof donnees.l !== 'string' || typeof donnees.e !== 'number') return { ok: false, raison: 'forme' }
  if (Math.floor(maintenant.getTime() / 1000) >= donnees.e) return { ok: false, raison: 'expire' }
  return { ok: true, userId: donnees.u, leconId: donnees.l, expireLe: donnees.e }
}

/** Le texte du filigrane : qui regarde, et quand. Pas de donnée qu'on ne voudrait pas voir fuiter. */
export function texteFiligrane({ email, userId, maintenant = new Date() }: { email: string; userId: string; maintenant?: Date }): string {
  const jour = maintenant.toISOString().slice(0, 16).replace('T', ' ')
  return `${email} · ${userId.slice(0, 8)} · ${jour}`
}

/**
 * Position (en % de la zone vidéo) du filigrane à l'instant `t`, déterministe : le même instant
 * donne la même position, ce qui permet de la tester. Elle saute d'un emplacement à l'autre pour
 * qu'on ne puisse pas la recadrer, et reste à 8 % des bords pour ne pas être rognée.
 */
export function positionFiligrane(t: number, pasSec = POLITIQUE_PROTECTION.deplacementFiligraneSec): { x: number; y: number } {
  const n = Math.floor(t / pasSec)
  // Petit générateur congruentiel : deux nombres 0..1 stables pour un `n` donné.
  const a = ((n * 1103515245 + 12345) >>> 0) / 0xffffffff
  const b = ((n * 1664525 + 1013904223) >>> 0) / 0xffffffff
  return { x: 8 + Math.round(a * 60), y: 8 + Math.round(b * 76) }
}

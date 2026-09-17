// Date d'expiration de la session, lue directement dans le cookie.
//
// Pourquoi ce fichier existe : `supabase.auth.getUser()` part TOUJOURS sur le
// réseau, même quand le jeton en poche est valable encore cinquante minutes.
// Le proxy l'appelait à chaque requête, et chaque page du tableau de bord le
// rappelait juste après — deux allers-retours vers Supabase avant la moindre
// lecture de données. Mesuré le 2026-09-17 : les fonctions s'exécutant à
// Washington et la base étant en Europe, un aller-retour coûtait 300 à 900 ms.
//
// Le cookie contient déjà l'échéance. La lire coûte zéro milliseconde, et
// permet de n'appeler Supabase que lorsque le renouvellement approche
// vraiment.
//
// ⚠️ Règle de prudence, qui gouverne tout ce fichier : au moindre doute on
// renvoie « je ne sais pas » (`null` / `false`), ce qui fait retomber
// l'appelant sur l'appel réseau d'avant. Le pire cas de ce raccourci est donc
// l'ancien comportement — jamais une déconnexion.
//
// Format écrit par @supabase/ssr (vérifié sur la version 0.10.3, fichier
// `dist/main/cookies.js`) : un cookie `sb-<projet>-auth-token` dont la valeur
// est `base64-` suivi du JSON de la session encodé en base64**url**. Au-delà de
// 3 180 caractères, la valeur est découpée en `…-auth-token.0`, `.1`, etc.

/** Préfixe que la bibliothèque pose devant une valeur encodée. */
const PREFIXE_BASE64 = 'base64-'

/**
 * Marge avant l'échéance en deçà de laquelle on renouvelle quand même.
 *
 * Elle couvre le temps de vie de la page rendue : les appels d'API déclenchés
 * juste après la navigation créent leur propre client Supabase, qui sait
 * renouveler de son côté, mais mieux vaut leur remettre un jeton encore large.
 */
export const MARGE_RAFRAICHISSEMENT_MS = 5 * 60 * 1000

export type CookieLu = { name: string; value: string }

/**
 * Cookies de session, et eux seuls.
 *
 * Le `$` final est ce qui écarte `sb-<projet>-auth-token-code-verifier`, posé
 * pendant la connexion : il ne contient pas de session, et le prendre pour
 * telle ferait échouer la lecture à chaque fois.
 */
const NOM_JETON = /^sb-.+-auth-token(?:\.(\d+))?$/

/** Recolle la valeur du cookie, qu'elle tienne en un seul ou en plusieurs. */
function valeurDuCookie(cookies: CookieLu[]): string | null {
  const morceaux: { index: number; valeur: string }[] = []
  let entier: string | null = null

  for (const cookie of cookies) {
    const trouve = NOM_JETON.exec(cookie.name)
    if (!trouve) continue
    if (trouve[1] === undefined) entier ??= cookie.value
    else morceaux.push({ index: Number(trouve[1]), valeur: cookie.value })
  }

  if (entier !== null) return entier
  if (morceaux.length === 0) return null

  morceaux.sort((a, b) => a.index - b.index)
  // Un morceau manquant donnerait un JSON tronqué, donc une échéance fausse :
  // on préfère ne rien conclure et laisser l'appel réseau trancher.
  if (morceaux.some((m, i) => m.index !== i)) return null
  return morceaux.map(m => m.valeur).join('')
}

/** base64url → texte. `null` si la valeur n'est pas décodable. */
function depuisBase64Url(valeur: string): string | null {
  try {
    const base64 = valeur.replace(/-/g, '+').replace(/_/g, '/')
    const complete = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const binaire = atob(complete)
    // Passage par les octets : le JSON contient des accents (nom du laveur), et
    // `atob` seul les rendrait illisibles.
    const octets = Uint8Array.from(binaire, c => c.charCodeAt(0))
    return new TextDecoder().decode(octets)
  } catch {
    return null
  }
}

function enObjet(texte: string): Record<string, unknown> | null {
  for (const candidat of [texte, ((): string | null => {
    try { return decodeURIComponent(texte) } catch { return null }
  })()]) {
    if (candidat === null) continue
    try {
      const objet = JSON.parse(candidat)
      if (objet && typeof objet === 'object') return objet as Record<string, unknown>
    } catch { /* on essaie la forme suivante */ }
  }
  return null
}

function sessionDuCookie(cookies: CookieLu[]): Record<string, unknown> | null {
  const brut = valeurDuCookie(cookies)
  if (brut === null) return null
  const texte = brut.startsWith(PREFIXE_BASE64)
    ? depuisBase64Url(brut.slice(PREFIXE_BASE64.length))
    : brut
  return texte === null ? null : enObjet(texte)
}

/**
 * Échéance de la session, en millisecondes depuis 1970.
 *
 * @returns `null` dès que la lecture est douteuse — cookie absent, découpé en
 *          morceaux incomplets, illisible, ou sans échéance.
 */
export function expirationSession(cookies: CookieLu[]): number | null {
  const session = sessionDuCookie(cookies)
  if (!session) return null

  // Le champ posé par Supabase, en secondes.
  const echeance = session.expires_at
  if (typeof echeance === 'number' && Number.isFinite(echeance)) return echeance * 1000

  // Repli : l'échéance inscrite dans le jeton lui-même. Utile si le format du
  // cookie change et perd `expires_at` — le jeton, lui, porte toujours `exp`.
  const jeton = session.access_token
  if (typeof jeton === 'string') {
    const charge = jeton.split('.')[1]
    const texte = charge ? depuisBase64Url(charge) : null
    const contenu = texte ? enObjet(texte) : null
    const exp = contenu?.exp
    if (typeof exp === 'number' && Number.isFinite(exp)) return exp * 1000
  }

  return null
}

/**
 * Le jeton tiendra-t-il encore assez longtemps pour qu'on se passe d'un
 * renouvellement ?
 *
 * `false` en cas de doute : l'appelant fait alors l'appel réseau habituel.
 */
export function jetonEncoreFrais(
  cookies: CookieLu[],
  maintenant: number,
  marge: number = MARGE_RAFRAICHISSEMENT_MS,
): boolean {
  const expiration = expirationSession(cookies)
  return expiration !== null && expiration - maintenant > marge
}

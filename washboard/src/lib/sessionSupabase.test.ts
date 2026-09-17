import { describe, it, expect } from 'vitest'
import {
  expirationSession, jetonEncoreFrais, MARGE_RAFRAICHISSEMENT_MS, type CookieLu,
} from './sessionSupabase'

const MAINTENANT = new Date('2026-09-17T12:00:00Z').getTime()
const DANS_UNE_HEURE = Math.floor(MAINTENANT / 1000) + 3600

/** Même encodage que @supabase/ssr : base64url, sans caractère de remplissage. */
function enBase64Url(texte: string): string {
  const octets = new TextEncoder().encode(texte)
  let binaire = ''
  octets.forEach(o => { binaire += String.fromCharCode(o) })
  return btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const cookieSession = (session: unknown, nom = 'sb-projet-auth-token'): CookieLu => ({
  name: nom,
  value: `base64-${enBase64Url(JSON.stringify(session))}`,
})

/** Jeton JWT minimal : seule la charge utile du milieu nous intéresse. */
const jwt = (charge: unknown) => `entete.${enBase64Url(JSON.stringify(charge))}.signature`

describe('expirationSession', () => {
  it('lit l’échéance posée par Supabase, en millisecondes', () => {
    const cookies = [cookieSession({ expires_at: DANS_UNE_HEURE, access_token: 'peu importe' })]
    expect(expirationSession(cookies)).toBe(DANS_UNE_HEURE * 1000)
  })

  it('recolle un cookie découpé en morceaux, dans l’ordre des indices', () => {
    const entier = cookieSession({ expires_at: DANS_UNE_HEURE }).value
    const coupe = Math.floor(entier.length / 2)
    // Volontairement donnés dans le désordre : le navigateur ne garantit rien.
    const cookies: CookieLu[] = [
      { name: 'sb-projet-auth-token.1', value: entier.slice(coupe) },
      { name: 'sb-projet-auth-token.0', value: entier.slice(0, coupe) },
    ]
    expect(expirationSession(cookies)).toBe(DANS_UNE_HEURE * 1000)
  })

  it('refuse de conclure si un morceau manque', () => {
    // Un JSON tronqué donnerait une échéance fausse : mieux vaut l’appel réseau.
    const entier = cookieSession({ expires_at: DANS_UNE_HEURE }).value
    const cookies: CookieLu[] = [
      { name: 'sb-projet-auth-token.0', value: entier.slice(0, 20) },
      { name: 'sb-projet-auth-token.2', value: entier.slice(20) },
    ]
    expect(expirationSession(cookies)).toBeNull()
  })

  it('préserve les accents du JSON', () => {
    // `atob` seul rendrait « Célia » illisible et ferait échouer la lecture.
    const cookies = [cookieSession({ expires_at: DANS_UNE_HEURE, user: { name: 'Célia Kooki' } })]
    expect(expirationSession(cookies)).toBe(DANS_UNE_HEURE * 1000)
  })

  it('accepte une valeur en clair, sans le préfixe base64', () => {
    const cookies: CookieLu[] = [
      { name: 'sb-projet-auth-token', value: JSON.stringify({ expires_at: DANS_UNE_HEURE }) },
    ]
    expect(expirationSession(cookies)).toBe(DANS_UNE_HEURE * 1000)
  })

  it('se rabat sur l’échéance inscrite dans le jeton quand `expires_at` manque', () => {
    const cookies = [cookieSession({ access_token: jwt({ exp: DANS_UNE_HEURE }) })]
    expect(expirationSession(cookies)).toBe(DANS_UNE_HEURE * 1000)
  })

  it('ignore le cookie de connexion en cours, qui ne porte pas de session', () => {
    const cookies: CookieLu[] = [
      { name: 'sb-projet-auth-token-code-verifier', value: 'abc123' },
    ]
    expect(expirationSession(cookies)).toBeNull()
  })

  it('renvoie null sur tout ce qui n’est pas lisible', () => {
    expect(expirationSession([])).toBeNull()
    expect(expirationSession([{ name: 'autre-cookie', value: 'x' }])).toBeNull()
    expect(expirationSession([{ name: 'sb-projet-auth-token', value: 'base64-???' }])).toBeNull()
    expect(expirationSession([{ name: 'sb-projet-auth-token', value: 'pas du json' }])).toBeNull()
    expect(expirationSession([cookieSession({ expires_at: 'bientôt' })])).toBeNull()
    expect(expirationSession([cookieSession({ access_token: 'jeton-sans-point' })])).toBeNull()
  })
})

describe('jetonEncoreFrais', () => {
  it('jeton valable encore une heure : aucun renouvellement nécessaire', () => {
    const cookies = [cookieSession({ expires_at: DANS_UNE_HEURE })]
    expect(jetonEncoreFrais(cookies, MAINTENANT)).toBe(true)
  })

  it('jeton qui expire dans la marge : on renouvelle', () => {
    const bientot = Math.floor((MAINTENANT + MARGE_RAFRAICHISSEMENT_MS - 1000) / 1000)
    expect(jetonEncoreFrais([cookieSession({ expires_at: bientot })], MAINTENANT)).toBe(false)
  })

  it('jeton déjà expiré : on renouvelle', () => {
    const hier = Math.floor(MAINTENANT / 1000) - 86400
    expect(jetonEncoreFrais([cookieSession({ expires_at: hier })], MAINTENANT)).toBe(false)
  })

  it('cookie illisible : on retombe sur l’appel réseau, jamais sur une déconnexion', () => {
    expect(jetonEncoreFrais([{ name: 'sb-projet-auth-token', value: 'base64-???' }], MAINTENANT)).toBe(false)
    expect(jetonEncoreFrais([], MAINTENANT)).toBe(false)
  })
})

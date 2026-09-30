import { describe, it, expect } from 'vitest'
import {
  lireAttributionUrl, relireAttribution, serialiser, choisirAttribution,
  estVide, estRobot, nettoyerValeur, FENETRE_JOURS,
} from './attribution'

// ─────────────────────────────────────────────────────────────────────────────
// L'attribution décide de tout ce que le laveur lira sur sa publicité. Une
// erreur ici lui fait couper une campagne qui marchait, ou prolonger une
// campagne qui lui coûte de l'argent.
// ─────────────────────────────────────────────────────────────────────────────

const JOUR = 24 * 60 * 60 * 1000
const T0 = new Date('2026-09-15T10:00:00Z').getTime()

describe('lireAttributionUrl', () => {
  it('lit les quatre paramètres', () => {
    const a = lireAttributionUrl('?utm_source=facebook&utm_medium=cpc&utm_campaign=pub-rentree&utm_content=video-bmw')
    expect(a).toEqual({ source: 'facebook', medium: 'cpc', campagne: 'pub-rentree', creation: 'video-bmw' })
  })

  it('accepte une campagne seule', () => {
    expect(lireAttributionUrl('?utm_campaign=pub-rentree')?.campagne).toBe('pub-rentree')
  })

  it('rend null quand l’URL ne porte aucune origine', () => {
    expect(lireAttributionUrl('')).toBeNull()
    expect(lireAttributionUrl('?autre=1')).toBeNull()
  })

  it('nettoie ce qui vient d’une URL publique', () => {
    // La valeur arrive de n'importe qui et finit en base : tout ce qui n'est
    // pas une lettre, un chiffre, un tiret ou un souligné saute.
    expect(nettoyerValeur('Pub Rentrée<script>')).toBe('pubrentrescript')
    expect(nettoyerValeur('a'.repeat(200))?.length).toBe(64)
    expect(nettoyerValeur('!!!')).toBeUndefined()
    expect(nettoyerValeur(null)).toBeUndefined()
  })
})

describe('relireAttribution', () => {
  it('relit ce qui a été mémorisé', () => {
    const brut = serialiser({ campagne: 'pub-rentree' }, T0)
    expect(relireAttribution(brut, T0 + JOUR)).toEqual({
      source: undefined, medium: undefined, campagne: 'pub-rentree', creation: undefined,
    })
  })

  it('tient toute la fenêtre, et pas un jour de plus', () => {
    const brut = serialiser({ campagne: 'pub-rentree' }, T0)
    expect(relireAttribution(brut, T0 + (FENETRE_JOURS - 1) * JOUR)).not.toBeNull()
    expect(relireAttribution(brut, T0 + (FENETRE_JOURS + 1) * JOUR)).toBeNull()
  })

  it('jette un horodatage venu du futur', () => {
    // Horloge déréglée ou valeur fabriquée à la main : on repart de zéro
    // plutôt que de garder ça trente jours.
    const brut = serialiser({ campagne: 'pub-rentree' }, T0 + 10 * JOUR)
    expect(relireAttribution(brut, T0)).toBeNull()
  })

  it('ne casse jamais sur une valeur abîmée', () => {
    // Quelqu'un peut écrire n'importe quoi dans son propre navigateur. Le pire
    // qui puisse arriver est de perdre une attribution.
    for (const brut of [null, '', 'pas du json', '{}', '[]', '{"a":null,"t":"x"}', '{"a":{"campagne":123}}']) {
      expect(() => relireAttribution(brut, T0)).not.toThrow()
      expect(relireAttribution(brut, T0)).toBeNull()
    }
  })
})

describe('choisirAttribution — dernier clic', () => {
  it('l’URL écrase toujours ce qui était retenu', () => {
    // Publicité Instagram lundi, publicité TikTok jeudi, réservation jeudi :
    // c'est TikTok qui a emporté la décision.
    const choisie = choisirAttribution({ campagne: 'tiktok-oct' }, { campagne: 'insta-sept' })
    expect(choisie?.campagne).toBe('tiktok-oct')
  })

  it('écrase EN ENTIER, jamais champ par champ', () => {
    // Garder la création de l'ancienne campagne à côté de la nouvelle source
    // fabriquerait une origine qui n'a jamais existé.
    const choisie = choisirAttribution(
      { campagne: 'tiktok-oct' },
      { campagne: 'insta-sept', creation: 'video-bmw', source: 'facebook' },
    )
    expect(choisie).toEqual({ campagne: 'tiktok-oct' })
    expect(choisie?.creation).toBeUndefined()
    expect(choisie?.source).toBeUndefined()
  })

  it('garde ce qui était retenu quand l’URL est nue', () => {
    // Le cas qui justifie toute la mémoire : il revient en direct pour
    // réserver, trois jours après avoir cliqué la publicité.
    expect(choisirAttribution(null, { campagne: 'pub-rentree' })?.campagne).toBe('pub-rentree')
  })

  it('rend null quand il n’y a rien des deux côtés', () => {
    expect(choisirAttribution(null, null)).toBeNull()
    expect(choisirAttribution({}, {})).toBeNull()
  })
})

describe('estVide', () => {
  it('reconnaît une origine sans aucune information', () => {
    expect(estVide(null)).toBe(true)
    expect(estVide({})).toBe(true)
    expect(estVide({ campagne: 'x' })).toBe(false)
    expect(estVide({ creation: 'x' })).toBe(false)
  })
})

describe('estRobot', () => {
  it('écarte les aperçus de liens, qui arrivent AVANT le premier humain', () => {
    // Meta, TikTok et les messageries préchargent tout lien qu'on leur donne.
    // Une publicité fraîchement publiée reçoit ces visites sans qu'aucune
    // personne n'ait cliqué.
    for (const ua of [
      'facebookexternalhit/1.1',
      'Mozilla/5.0 (compatible; Meta-ExternalAgent/1.1)',
      'TikTok 30.1.0 rv:301014 (iPhone)',
      'WhatsApp/2.23',
      'Slackbot-LinkExpanding 1.0',
      'TelegramBot (like TwitterBot)',
    ]) {
      expect(estRobot(ua), ua).toBe(true)
    }
  })

  it('écarte les robots d’indexation et les outils', () => {
    for (const ua of ['Googlebot/2.1', 'bingbot/2.0', 'AhrefsBot/7.0', 'curl/8.4.0', 'python-requests/2.31', 'HeadlessChrome/120']) {
      expect(estRobot(ua), ua).toBe(true)
    }
  })

  it('écarte un agent absent ou vide', () => {
    // Tous les navigateurs réels en envoient un. Son absence signale un appel
    // programmatique.
    expect(estRobot(null)).toBe(true)
    expect(estRobot('')).toBe(true)
    expect(estRobot('   ')).toBe(true)
  })

  it('laisse passer les vrais navigateurs', () => {
    for (const ua of [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    ]) {
      expect(estRobot(ua), ua).toBe(false)
    }
  })
})

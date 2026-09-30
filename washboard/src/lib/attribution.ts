// D'où vient un visiteur, et comment cette origine survit jusqu'à sa
// réservation.
//
// Tout ce qui est calculable est ici, sans base ni navigateur, pour être
// vérifiable ligne à ligne. Les deux seuls points d'entrée qui touchent le
// navigateur (`memoriserAttribution`, `attributionCourante`) sont isolés en
// bas de fichier.
//
// ── Ce qu'on garde, et ce qu'on ne garde pas ────────────────────────────────
//
// On garde les quatre paramètres UTM : ils décrivent une ANNONCE, pas une
// personne. « pub-rentree » ne dit rien de qui a cliqué.
//
// On ne garde PAS `fbclid`, `ttclid` ni `gclid`. Ce sont des identifiants
// publicitaires émis par des tiers, qui ne servent qu'aux API de conversion
// côté serveur — qu'on n'implémente pas. Les collecter « au cas où » ferait
// basculer la page de réservation dans le régime du consentement, donc
// imposerait un bandeau devant le formulaire : il coûterait au laveur plus de
// clients qu'il ne lui rapporterait de statistiques.

export type Attribution = {
  source?: string
  medium?: string
  campagne?: string
  creation?: string
}

/** Combien de temps l'origine survit dans le navigateur.
 *
 *  Trente jours, en DERNIER CLIC : quelqu'un qui clique la publicité lundi et
 *  réserve jeudi est rattaché à la campagne. Sans cette mémoire, il tombait
 *  dans « accès direct » et le laveur concluait que sa pub ne marchait pas.
 *
 *  Trente jours et pas plus : au-delà, le lien entre la publicité et la
 *  réservation devient une supposition, et un chiffre supposé vaut moins que
 *  pas de chiffre du tout. */
export const FENETRE_JOURS = 30
const FENETRE_MS = FENETRE_JOURS * 24 * 60 * 60 * 1000

const CLE_STOCKAGE = 'wb_attribution'

/** Longueur au-delà de laquelle une valeur est tronquée. Une clé de campagne
 *  fait quarante caractères ; plus long, c'est qu'on nous envoie autre chose,
 *  et cette valeur finit en base. */
const VALEUR_MAX = 64

/** Nettoie une valeur venue d'une URL publique, donc de n'importe qui. */
export function nettoyerValeur(brut: string | null | undefined): string | undefined {
  if (!brut) return undefined
  const propre = brut.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, VALEUR_MAX)
  return propre || undefined
}

/** Lit les UTM d'une chaîne de requête. `null` si elle n'en porte aucun. */
export function lireAttributionUrl(search: string): Attribution | null {
  const p = new URLSearchParams(search)
  const a: Attribution = {
    source:   nettoyerValeur(p.get('utm_source')),
    medium:   nettoyerValeur(p.get('utm_medium')),
    campagne: nettoyerValeur(p.get('utm_campaign')),
    creation: nettoyerValeur(p.get('utm_content')),
  }
  return estVide(a) ? null : a
}

export function estVide(a: Attribution | null | undefined): boolean {
  return !a || (!a.source && !a.medium && !a.campagne && !a.creation)
}

type Stockee = { a: Attribution; t: number }

export function serialiser(a: Attribution, maintenant: number): string {
  return JSON.stringify({ a, t: maintenant } satisfies Stockee)
}

/** Relit ce qui a été mémorisé, et le jette s'il a dépassé la fenêtre.
 *
 *  Tolérant à tout : une valeur illisible, un champ manquant, un horodatage
 *  absurde rendent `null`. Le pire qui puisse arriver est de perdre une
 *  attribution — jamais de casser la page de réservation. */
export function relireAttribution(brut: string | null | undefined, maintenant: number): Attribution | null {
  if (!brut) return null
  try {
    const lu = JSON.parse(brut) as Partial<Stockee>
    if (!lu || typeof lu.t !== 'number' || !Number.isFinite(lu.t)) return null
    if (maintenant - lu.t > FENETRE_MS) return null
    // Un horodatage dans le futur signale une horloge déréglée ou une valeur
    // fabriquée : on repart de zéro plutôt que de garder ça trente jours.
    if (lu.t > maintenant + 60_000) return null
    const a: Attribution = {
      source:   nettoyerValeur(lu.a?.source),
      medium:   nettoyerValeur(lu.a?.medium),
      campagne: nettoyerValeur(lu.a?.campagne),
      creation: nettoyerValeur(lu.a?.creation),
    }
    return estVide(a) ? null : a
  } catch {
    return null
  }
}

/** L'origine à retenir, entre celle de l'URL et celle déjà mémorisée.
 *
 *  DERNIER CLIC : une URL qui porte des UTM écrase toujours ce qui était
 *  retenu. Si quelqu'un clique une publicité Instagram puis, deux jours plus
 *  tard, une publicité TikTok avant de réserver, c'est TikTok qui a emporté la
 *  décision — c'est la dernière chose qu'il a vue avant de venir.
 *
 *  Et l'écrasement est TOTAL, jamais champ par champ : garder la création de
 *  l'ancienne campagne à côté de la nouvelle source fabriquerait une origine
 *  qui n'a jamais existé. */
export function choisirAttribution(url: Attribution | null, memorisee: Attribution | null): Attribution | null {
  if (!estVide(url)) return url
  return estVide(memorisee) ? null : memorisee
}

// ── Reconnaissance des robots ───────────────────────────────────────────────

/** Signatures de robots, en minuscules.
 *
 *  Les trois premières familles comptent le plus ici : Meta, TikTok et les
 *  messageries PRÉCHARGENT tout lien qu'on leur donne, pour en fabriquer
 *  l'aperçu. Une publicité qui vient d'être publiée reçoit donc une poignée de
 *  visites avant qu'un seul humain ait cliqué — et sur une campagne à 80 € qui
 *  fait trois cents visites, ces fausses visites écrasent le taux de
 *  transformation, sur lequel le laveur décide de couper ou non. */
const SIGNATURES_ROBOT = [
  'facebookexternalhit', 'facebookcatalog', 'meta-externalagent', 'instagram',
  'tiktok', 'bytespider',
  'whatsapp', 'telegrambot', 'slackbot', 'discordbot', 'twitterbot', 'linkedinbot',
  'googlebot', 'adsbot-google', 'bingbot', 'yandexbot', 'duckduckbot', 'applebot',
  'ahrefsbot', 'semrushbot', 'mj12bot', 'dotbot', 'petalbot',
  'headlesschrome', 'phantomjs', 'puppeteer', 'playwright',
  'bot', 'crawler', 'spider', 'scraper', 'curl', 'wget', 'python-requests', 'axios',
] as const

/** Vrai si ce navigateur est une machine.
 *
 *  Un agent vide compte AUSSI comme un robot : tous les navigateurs réels en
 *  envoient un. Son absence signale un appel programmatique.
 *
 *  La liste finit par des mots génériques (`bot`, `crawler`) qui attrapent
 *  large. Le sens de l'erreur est voulu : mieux vaut écarter une visite
 *  humaine de temps en temps que gonfler un dénominateur sur lequel quelqu'un
 *  décide de couper sa publicité. */
export function estRobot(userAgent: string | null | undefined): boolean {
  if (!userAgent || !userAgent.trim()) return true
  const ua = userAgent.toLowerCase()
  return SIGNATURES_ROBOT.some(s => ua.includes(s))
}

// ── Accès au navigateur ─────────────────────────────────────────────────────

/** Lit l'URL, mémorise ce qu'elle porte, et rend l'origine à utiliser.
 *
 *  Stocké en `localStorage` et pas en `sessionStorage`, contrairement à
 *  l'identifiant de session : c'est ce qui permet de rattacher une réservation
 *  faite trois jours après le clic. Ce qui y est écrit ne décrit que l'annonce
 *  — aucune information sur la personne — et ne quitte jamais le site. */
export function memoriserAttribution(search: string, maintenant: number = Date.now()): Attribution | null {
  const depuisUrl = lireAttributionUrl(search)
  if (typeof window === 'undefined') return depuisUrl

  try {
    if (depuisUrl) {
      window.localStorage.setItem(CLE_STOCKAGE, serialiser(depuisUrl, maintenant))
      return depuisUrl
    }
    const memorisee = relireAttribution(window.localStorage.getItem(CLE_STOCKAGE), maintenant)
    return choisirAttribution(null, memorisee)
  } catch {
    // Stockage refusé : navigation privée stricte, réglage « bloquer les
    // données de sites », et surtout les navigateurs intégrés de TikTok ou
    // Instagram — par où arrive une bonne part du trafic des laveurs. On se
    // contente de l'URL. Pas de mesure plutôt qu'un parcours cassé.
    return depuisUrl
  }
}

/** L'origine retenue pour cette visite, sans rien réécrire. */
export function attributionCourante(maintenant: number = Date.now()): Attribution | null {
  if (typeof window === 'undefined') return null
  try {
    return relireAttribution(window.localStorage.getItem(CLE_STOCKAGE), maintenant)
  } catch {
    return null
  }
}

/** Efface l'origine mémorisée. Utile après une réservation : la suivante n'a
 *  aucune raison d'être encore attribuée à la publicité d'il y a trois
 *  semaines. */
export function oublierAttribution(): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.removeItem(CLE_STOCKAGE) } catch { /* rien à faire */ }
}

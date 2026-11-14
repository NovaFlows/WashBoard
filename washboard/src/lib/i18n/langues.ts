// Langues de l'interface (2026-11-14). Le français est la langue source : le texte français écrit
// dans le code SERT DE CLÉ. Une phrase absente d'un dictionnaire reste donc en français, jamais
// vide, ce qui permet de traduire l'appli partie par partie sans rien casser.

export const LANGUES = ['fr', 'en', 'es', 'de'] as const
export type Langue = (typeof LANGUES)[number]
export const LANGUE_PAR_DEFAUT: Langue = 'fr'

/** Nom de chaque langue, écrit dans cette langue (c'est ce que la personne reconnaît). */
export const NOMS_LANGUES: Record<Langue, string> = {
  fr: 'Français',
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
}

export const COOKIE_LANGUE = 'wb_lang'

export function estLangue(valeur: unknown): valeur is Langue {
  return typeof valeur === 'string' && (LANGUES as readonly string[]).includes(valeur)
}

// Pays → langue, pour une première visite sans préférence ni langue de navigateur exploitable.
const PAYS_ES = ['ES', 'MX', 'AR', 'CO', 'CL', 'PE', 'VE', 'EC', 'UY', 'PY', 'BO', 'CR', 'PA', 'DO', 'GT', 'HN', 'SV', 'NI', 'CU', 'PR']
const PAYS_DE = ['DE', 'AT', 'LI']
const PAYS_FR = ['FR', 'BE', 'CH', 'LU', 'CA', 'MC', 'SN', 'CI', 'CM', 'MA', 'DZ', 'TN', 'RE', 'GP', 'MQ', 'GF', 'NC', 'PF']

export function langueDuPays(pays: string | null | undefined): Langue | null {
  const p = (pays ?? '').trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(p)) return null
  if (PAYS_FR.includes(p)) return 'fr'
  if (PAYS_ES.includes(p)) return 'es'
  if (PAYS_DE.includes(p)) return 'de'
  return 'en'
}

/** Première langue gérée dans l'en-tête Accept-Language, en respectant l'ordre de préférence (q). */
export function langueDuNavigateur(entete: string | null | undefined): Langue | null {
  if (!entete) return null
  const prefs = entete
    .split(',')
    .map((morceau, i) => {
      const [balise, ...params] = morceau.trim().split(';')
      const q = params.map(p => p.trim()).find(p => p.startsWith('q='))
      return { code: balise.trim().toLowerCase().split('-')[0], q: q ? Number(q.slice(2)) : 1, i }
    })
    .filter(p => p.code && Number.isFinite(p.q) && p.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i)
  for (const p of prefs) if (estLangue(p.code)) return p.code
  return null
}

// « headless » : les navigateurs pilotés (tests e2e Playwright, Lighthouse) restent en français, la
// langue que leurs vérifications attendent ; une vraie personne n'a jamais « Headless » dans son agent.
const ROBOTS = /bot|crawl|spider|slurp|preview|facebookexternalhit|lighthouse|headless/i

/**
 * Langue à servir : 1) le choix de la personne (cookie), 2) la langue de son navigateur, 3) son pays
 * (en-tête de géolocalisation de Vercel), 4) le français. Un robot (Google…) reçoit toujours le
 * français : il arrive sans langue, depuis les États-Unis, et ne doit pas indexer la version anglaise
 * à la place des pages françaises.
 */
export function detecterLangue(entrees: {
  cookie?: string | null
  acceptLanguage?: string | null
  pays?: string | null
  userAgent?: string | null
}): Langue {
  if (estLangue(entrees.cookie)) return entrees.cookie
  if (entrees.userAgent && ROBOTS.test(entrees.userAgent)) return LANGUE_PAR_DEFAUT
  return langueDuNavigateur(entrees.acceptLanguage) ?? langueDuPays(entrees.pays) ?? LANGUE_PAR_DEFAUT
}

export const LOCALES_OG: Record<Langue, string> = { fr: 'fr_FR', en: 'en_GB', es: 'es_ES', de: 'de_DE' }

/** Garde le choix de la personne un an (navigateur uniquement). */
export function memoriserLangue(langue: Langue): void {
  document.cookie = `${COOKIE_LANGUE}=${langue}; path=/; max-age=31536000; samesite=lax`
}

/** Code de locale pour Intl / toLocaleDateString (dates, heures, montants). */
export const LOCALES_INTL: Record<Langue, string> = { fr: 'fr-FR', en: 'en-GB', es: 'es-ES', de: 'de-DE' }

import { cookies, headers } from 'next/headers'
import { COOKIE_LANGUE, LANGUES, LOCALES_INTL, detecterLangue, type Langue } from './langues'
import { dictionnaireDe } from './dictionnaires'
import { creerTraducteur, type Traducteur } from './traduire'

/** Langue de la requête en cours (composants serveur, métadonnées). */
export async function getLangue(): Promise<Langue> {
  try {
    const [jar, h] = await Promise.all([cookies(), headers()])
    return detecterLangue({
      cookie: jar.get(COOKIE_LANGUE)?.value,
      acceptLanguage: h.get('accept-language'),
      pays: h.get('x-vercel-ip-country'),
      userAgent: h.get('user-agent'),
    })
  } catch {
    // Hors requête (test, tâche planifiée) : le français, jamais une erreur.
    return 'fr'
  }
}

/** `const t = await getT()` puis `t('Se connecter')` dans un composant serveur. */
export async function getT(): Promise<Traducteur> {
  return creerTraducteur(dictionnaireDe(await getLangue()))
}

/**
 * Traducteur des ARTICLES du blog : le dictionnaire de l'appli plus celui des articles, chargé à part
 * (et seulement par ces pages serveur) pour ne pas alourdir le dictionnaire envoyé à chaque visiteur.
 */
export async function getTArticle(): Promise<Traducteur> {
  const langue = await getLangue()
  const base = dictionnaireDe(langue)
  if (!base || langue === 'fr') return creerTraducteur(null)
  const { dictionnaireArticles } = await import('./dictionnaires/articles')
  return creerTraducteur({ ...base, ...(await dictionnaireArticles(langue)) })
}

/**
 * Traducteur d'un document hors page (PDF) : la langue demandée par le lien (`?lang=en`, posée quand le laveur
 * copie ou partage le lien depuis son compte) ou, à défaut, celle de la requête.
 */
export async function getTAvec(forcee?: string | null): Promise<{ t: Traducteur; loc: string; langue: Langue }> {
  const langue = (LANGUES as readonly string[]).includes(forcee ?? '') ? (forcee as Langue) : await getLangue()
  return { t: creerTraducteur(dictionnaireDe(langue)), loc: LOCALES_INTL[langue], langue }
}

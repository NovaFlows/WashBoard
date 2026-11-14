import { cookies, headers } from 'next/headers'
import { COOKIE_LANGUE, detecterLangue, type Langue } from './langues'
import { dictionnaireDe } from './dictionnaires'
import { creerTraducteur, type Traducteur } from './traduire'

/** Langue de la requête en cours (composants serveur, métadonnées). */
export async function getLangue(): Promise<Langue> {
  const [jar, h] = await Promise.all([cookies(), headers()])
  return detecterLangue({
    cookie: jar.get(COOKIE_LANGUE)?.value,
    acceptLanguage: h.get('accept-language'),
    pays: h.get('x-vercel-ip-country'),
    userAgent: h.get('user-agent'),
  })
}

/** `const t = await getT()` puis `t('Se connecter')` dans un composant serveur. */
export async function getT(): Promise<Traducteur> {
  return creerTraducteur(dictionnaireDe(await getLangue()))
}

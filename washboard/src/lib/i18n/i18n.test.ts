import { describe, expect, it } from 'vitest'
import { detecterLangue, langueDuNavigateur, langueDuPays } from './langues'
import { traduire } from './traduire'
import { en } from './dictionnaires/en'
import { es } from './dictionnaires/es'
import { de } from './dictionnaires/de'

describe('detecterLangue', () => {
  it('le choix de la personne (cookie) passe avant tout', () => {
    expect(detecterLangue({ cookie: 'de', acceptLanguage: 'fr-FR', pays: 'FR' })).toBe('de')
  })
  it('sinon la langue du navigateur, dans l\'ordre de préférence', () => {
    expect(detecterLangue({ acceptLanguage: 'es-MX,es;q=0.9,en;q=0.8', pays: 'FR' })).toBe('es')
    expect(langueDuNavigateur('ja,en;q=0.5,de;q=0.9')).toBe('de')
    expect(langueDuNavigateur('en;q=0,fr;q=0.5')).toBe('fr')
  })
  it('sinon le pays', () => {
    expect(detecterLangue({ pays: 'DE' })).toBe('de')
    expect(detecterLangue({ pays: 'AT' })).toBe('de')
    expect(detecterLangue({ pays: 'MX' })).toBe('es')
    expect(detecterLangue({ pays: 'US' })).toBe('en')
    expect(detecterLangue({ acceptLanguage: 'ja', pays: 'JP' })).toBe('en')
  })
  it('les pays francophones et l\'absence d\'indice restent en français', () => {
    expect(langueDuPays('BE')).toBe('fr')
    expect(langueDuPays('CA')).toBe('fr')
    expect(detecterLangue({})).toBe('fr')
    expect(detecterLangue({ cookie: 'xx', pays: '' })).toBe('fr')
  })
  it('un robot reçoit le français, même depuis les États-Unis', () => {
    expect(detecterLangue({ pays: 'US', userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1)' })).toBe('fr')
    // mais le choix explicite d'une langue reste respecté
    expect(detecterLangue({ cookie: 'en', userAgent: 'Googlebot' })).toBe('en')
  })
})

describe('traduire', () => {
  it('garde le français quand la phrase est inconnue ou la traduction vide', () => {
    expect(traduire(en, 'Phrase inconnue')).toBe('Phrase inconnue')
    expect(traduire({ a: '' }, 'a')).toBe('a')
    expect(traduire(null, 'Se connecter')).toBe('Se connecter')
  })
  it('remplace les variables', () => {
    expect(traduire(en, 'Lien envoyé à {email}', { email: 'a@b.fr' })).toBe('Link sent to a@b.fr')
    expect(traduire(null, 'Salut {nom}', { nom: 'Léa' })).toBe('Salut Léa')
  })
})

describe('dictionnaires', () => {
  const cles = Object.keys(en).sort()
  it.each([['es', es], ['de', de]] as const)('%s a exactement les mêmes phrases que en', (_l, d) => {
    expect(Object.keys(d).sort()).toEqual(cles)
  })
  it.each([['en', en], ['es', es], ['de', de]] as const)('%s : aucune traduction vide, mêmes {variables} que le français', (_l, d) => {
    for (const [cle, valeur] of Object.entries(d)) {
      expect(valeur.trim(), cle).not.toBe('')
      const vars = (s: string) => new Set(s.match(/\{\w+\}/g) ?? [])
      // Une traduction peut OMETTRE une variable de pluriel (`{v1}` = « s » ou rien dans la phrase française, inutile
      // en allemand par exemple), jamais en inventer une, ni omettre une vraie valeur.
      for (const v of vars(valeur)) expect(vars(cle).has(v), `${cle} : ${v} inconnue`).toBe(true)
      for (const v of vars(cle)) if (!vars(valeur).has(v)) expect(/^\{v\d+\}$/.test(v), `${cle} : ${v} omise`).toBe(true)
    }
  })
})

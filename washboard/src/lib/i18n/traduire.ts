export type Dictionnaire = Readonly<Record<string, string>>
export type Variables = Readonly<Record<string, string | number | boolean | null | undefined>>

/**
 * Traduit une phrase française. `{nom}` est remplacé par la valeur de `variables`.
 * Phrase absente du dictionnaire (ou langue française) : le français d'origine, jamais une clé vide.
 */
export function traduire(dictionnaire: Dictionnaire | null, phrase: string, variables?: Variables): string {
  const base = dictionnaire?.[phrase] || phrase
  // Outil de relecture (jamais en production) : `I18N_LOG=1 npm run dev` liste dans la console les phrases
  // passées à t() qui n'ont pas de traduction, pour les compléter page par page.
  if (dictionnaire && !dictionnaire[phrase] && process.env.I18N_LOG === '1' && /[A-Za-zÀ-ÿ]{3}/.test(phrase)) console.warn('[i18n-manquant]', JSON.stringify(phrase))
  if (!variables) return base
  return base.replace(/\{(\w+)\}/g, (m, nom: string) => (nom in variables ? (variables[nom] == null || variables[nom] === false ? '' : String(variables[nom])) : m))
}

export type Traducteur = (phrase: string, variables?: Variables) => string

/** Traducteur par défaut des fonctions de `lib/` : le français, variables remplacées. */
export const sansTraduction: Traducteur = (phrase, variables) => traduire(null, phrase, variables)

export function creerTraducteur(dictionnaire: Dictionnaire | null): Traducteur {
  return (phrase, variables) => traduire(dictionnaire, phrase, variables)
}

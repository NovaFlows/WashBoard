export type Dictionnaire = Readonly<Record<string, string>>
export type Variables = Readonly<Record<string, string | number>>

/**
 * Traduit une phrase française. `{nom}` est remplacé par la valeur de `variables`.
 * Phrase absente du dictionnaire (ou langue française) : le français d'origine, jamais une clé vide.
 */
export function traduire(dictionnaire: Dictionnaire | null, phrase: string, variables?: Variables): string {
  const base = dictionnaire?.[phrase] || phrase
  if (!variables) return base
  return base.replace(/\{(\w+)\}/g, (m, nom: string) => (nom in variables ? String(variables[nom]) : m))
}

export type Traducteur = (phrase: string, variables?: Variables) => string

export function creerTraducteur(dictionnaire: Dictionnaire | null): Traducteur {
  return (phrase, variables) => traduire(dictionnaire, phrase, variables)
}

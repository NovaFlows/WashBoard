import { Fragment, type ReactNode } from 'react'

type Traduire = (phrase: string) => string

/**
 * Traduit une phrase qui contient de la mise en forme : « Où trouver mon lien de <b>réservation</b> ? ».
 * La phrase entière est la clé (`{e0}` marque la place de l'élément), la traduction peut placer l'élément où sa
 * langue le veut, ce qu'un découpage morceau par morceau ne permettait pas.
 *
 *   {trans(t, 'Où trouver mon lien de {e0} ?', { e0: <b>{t('réservation')}</b> })}
 */
export function trans(t: Traduire, cle: string, valeurs: Record<string, ReactNode>): ReactNode {
  return t(cle)
    .split(/(\{\w+\})/)
    .map((morceau, i) => {
      const m = /^\{(\w+)\}$/.exec(morceau)
      return m && m[1] in valeurs ? <Fragment key={i}>{valeurs[m[1]]}</Fragment> : morceau
    })
}

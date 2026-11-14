'use client'

import { createContext, useContext, useMemo } from 'react'
import type { Langue } from '@/lib/i18n/langues'
import { creerTraducteur, type Dictionnaire, type Traducteur } from '@/lib/i18n/traduire'

type Contexte = { langue: Langue; t: Traducteur }

const I18nContext = createContext<Contexte>({ langue: 'fr', t: creerTraducteur(null) })

export function I18nProvider({ langue, dictionnaire, children }: { langue: Langue; dictionnaire: Dictionnaire | null; children: React.ReactNode }) {
  const valeur = useMemo(() => ({ langue, t: creerTraducteur(dictionnaire) }), [langue, dictionnaire])
  return <I18nContext.Provider value={valeur}>{children}</I18nContext.Provider>
}

/** Composants client : `const t = useT()` puis `t('Se connecter')`. */
export function useT(): Traducteur {
  return useContext(I18nContext).t
}

export function useLangue(): Langue {
  return useContext(I18nContext).langue
}

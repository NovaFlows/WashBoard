import type { Dictionnaire } from '../traduire'
import { commun } from './en/commun'
import { landing } from './en/landing'

// Une partie par fichier : pour traduire un nouvel écran, ajouter `./en/<partie>.ts` ici.
export const en: Dictionnaire = { ...commun, ...landing }

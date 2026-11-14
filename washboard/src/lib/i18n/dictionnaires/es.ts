import type { Dictionnaire } from '../traduire'
import { commun } from './es/commun'
import { landing } from './es/landing'

// Une partie par fichier : pour traduire un nouvel écran, ajouter `./es/<partie>.ts` ici.
export const es: Dictionnaire = { ...commun, ...landing }

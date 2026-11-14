import type { Dictionnaire } from '../traduire'
import { commun } from './de/commun'
import { landing } from './de/landing'

// Une partie par fichier : pour traduire un nouvel écran, ajouter `./de/<partie>.ts` ici.
export const de: Dictionnaire = { ...commun, ...landing }

import type { Dictionnaire } from '../traduire'
import { commun } from './de/commun'
import { landing } from './de/landing'
import { tableau } from './de/tableau'
import { reglages } from './de/reglages'

// Une partie par fichier : pour traduire un nouvel écran, ajouter `./de/<partie>.ts` ici.
export const de: Dictionnaire = { ...commun, ...landing, ...tableau, ...reglages }

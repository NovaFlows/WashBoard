import type { Dictionnaire } from '../traduire'
import { commun } from './de/commun'
import { landing } from './de/landing'
import { tableau } from './de/tableau'
import { reglages } from './de/reglages'
import { meteo } from './de/meteo'
import { messages } from './de/messages'
import { landing2 } from './de/landing2'
import { faq } from './de/faq'
import { landing3 } from './de/landing3'
import { demo } from './de/demo'
import { demo2 } from './de/demo2'
import { demo3 } from './de/demo3'

// Une partie par fichier : pour traduire un nouvel écran, ajouter `./de/<partie>.ts` ici.
export const de: Dictionnaire = { ...commun, ...landing, ...tableau, ...reglages, ...meteo, ...messages, ...landing2, ...faq, ...landing3, ...demo, ...demo2, ...demo3 }

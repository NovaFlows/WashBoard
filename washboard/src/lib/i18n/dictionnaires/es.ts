import type { Dictionnaire } from '../traduire'
import { commun } from './es/commun'
import { landing } from './es/landing'
import { tableau } from './es/tableau'
import { reglages } from './es/reglages'
import { meteo } from './es/meteo'
import { messages } from './es/messages'
import { landing2 } from './es/landing2'
import { faq } from './es/faq'
import { landing3 } from './es/landing3'

// Une partie par fichier : pour traduire un nouvel écran, ajouter `./es/<partie>.ts` ici.
export const es: Dictionnaire = { ...commun, ...landing, ...tableau, ...reglages, ...meteo, ...messages, ...landing2, ...faq, ...landing3 }

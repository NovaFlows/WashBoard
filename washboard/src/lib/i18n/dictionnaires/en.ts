import type { Dictionnaire } from '../traduire'
import { commun } from './en/commun'
import { landing } from './en/landing'
import { tableau } from './en/tableau'
import { reglages } from './en/reglages'
import { meteo } from './en/meteo'
import { messages } from './en/messages'
import { landing2 } from './en/landing2'
import { faq } from './en/faq'
import { landing3 } from './en/landing3'

// Une partie par fichier : pour traduire un nouvel écran, ajouter `./en/<partie>.ts` ici.
export const en: Dictionnaire = { ...commun, ...landing, ...tableau, ...reglages, ...meteo, ...messages, ...landing2, ...faq, ...landing3 }

import type { Dictionnaire } from '../traduire'
import type { Langue } from '../langues'
import { en } from './en'
import { es } from './es'
import { de } from './de'

// Un fichier par langue, qui assemble les PARTIES de l'appli (commun, landing, connexion…).
// Pour traduire une nouvelle partie : créer `<partie>.ts` dans chaque dossier de langue puis
// l'ajouter à l'assemblage de la langue.
const DICTIONNAIRES: Record<Langue, Dictionnaire | null> = { fr: null, en, es, de }

export function dictionnaireDe(langue: Langue): Dictionnaire | null {
  return DICTIONNAIRES[langue]
}

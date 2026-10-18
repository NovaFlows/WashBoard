import type { Dispatch } from 'react'
import type { Action } from './etat'
import type { EcranDemo, Etat, Feuille, Reglages, Vue } from './types'

/** Ce que reçoit chaque écran de l'application : la vue locale de l'appareil, l'état partagé et les actions. */
export type Ctrl = {
  dk: boolean
  v: Vue
  etat: Etat
  dispatch: Dispatch<Action>
  /** Change la vue en gardant le défilement. */
  maj: (p: Partial<Vue>) => void
  /** Change la vue et remonte en haut de l'écran. */
  nav: (p: Partial<Vue>) => void
  aller: (e: EcranDemo) => void
  ouvrir: (f: Feuille) => void
  fermer: () => void
  toast: (m: string) => void
  /** Ouvre la fiche d'un client. */
  client: (id: string) => void
  regler: (p: Partial<Reglages>) => void
  setForm: (nom: string, val: string) => void
  creer: (type: 'rdv' | 'client' | 'devis' | 'facture' | 'depense' | 'rappel') => void
}

// Types partagés de la démo : un seul état de journée fictive, des vues locales par appareil.

export type EcranDemo = 'auj' | 'agenda' | 'clients' | 'chiffres' | 'docs' | 'plus'

export type StatutRdv = 'termine' | 'cloturer' | 'confirme' | 'attente'

export type Rdv = {
  id?: string
  h: string
  fin: string
  nom: string
  presta: string
  veh?: string
  prix: number
  st: StatutRdv
  lieu?: string
  cli?: string
  /** Index du jour de la semaine (rendez-vous ajoutés à la main). */
  jour?: number
  neuf?: boolean
}

export type JourSemaine = { j: string; n: number; auj?: boolean; rdv?: Rdv[] }

export type Client = {
  id: string
  nom: string
  type: 'part' | 'pro'
  v: number
  ca: number
  der: string
  veh: string
  /** Tampons sur la carte de fidélité. */
  t: number
  ent?: boolean
  relance?: boolean
}

export type Doc = { n: string; t: 'Facture' | 'Devis'; cli: string; p: number; date: string; st: string }
export type Depense = { l: string; c: string; p: number }

export type Missions = { cloture: boolean; fiche: boolean; chiffres: boolean; promo: boolean }
export type CleMission = keyof Missions

export type Reglages = {
  avis: boolean
  canal: 'Email' | 'SMS'
  delai: number
  relance: boolean
  relMois: number
  acompteOn: boolean
  acompte: number
  acDelai: number
  acLien: string
  fidReq: number
  fidRec: string
  parVeh: boolean
  couleur: string
  prixComplet: number
  horaires: boolean[]
}

export type Etat = {
  cloture: boolean
  promo: boolean
  sophie: boolean
  m: Missions
  depenses: Depense[]
  docs: Doc[]
  clientsPlus: Client[]
  rdvPlus: Rdv[]
  payees: Record<string, boolean>
  nePlus: Record<string, boolean>
  r: Reglages
}

export type SousEcran =
  | 'promo' | 'fid' | 'acompte' | 'prestations' | 'horaires' | 'apparence' | 'liens'
  | 'avis' | 'relance' | 'profil' | 'abonnement' | 'guide' | 'docs' | 'chiffres'

export type Feuille =
  | { t: 'rdv'; id: string }
  | { t: 'rdvinfo'; nom: string; presta: string; prix: number; h: string; st: StatutRdv }
  | { t: 'cloture' }
  | { t: 'nouveau' }
  | { t: 'f-rdv' | 'f-client' | 'f-devis' | 'f-facture' | 'f-depense' | 'f-rappel' | 'itin' | 'appel' | 'options' }
  | { t: 'proposer'; quand: string; ou: string }
  | { t: 'actions'; id: string }
  | { t: 'doc'; n: string }

export type Vue = {
  ecran: EcranDemo
  fiche: string | null
  sous: SousEcran | null
  jour: number
  vueAg: 'jour' | 'semaine' | 'mois'
  filtre: 'tous' | 'pros' | 'relance'
  filtreDoc: 'tous' | 'factures' | 'devis'
  q: string
  qGuide: string
  guide: number | null
  barre: number | null
  feuille: Feuille | null
  clientSel: string
  onglet: 'argent' | 'acquisition' | 'clients'
  form: Record<string, string>
  /** Incrémenté à chaque navigation : le défilement repart en haut. */
  nk: number
}

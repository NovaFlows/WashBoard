import type { Client, CleMission, Depense, Doc, JourSemaine, Rdv, StatutRdv } from './types'

// Une journée fictive d'Éclat Mobile, à Bordeaux. Aucune donnée réelle.

export const RDV: Rdv[] = [
  { id: 'r1', h: '09:00', fin: '10:30', nom: 'Thomas Girard', presta: 'Rénovation sièges', veh: 'Voiture', prix: 120, st: 'termine', lieu: '12 rue Ulysse Gayon, Caudéran', cli: 'c2' },
  { id: 'r2', h: '11:30', fin: '12:40', nom: 'Camille Lefebvre', presta: 'Extérieur + intérieur', veh: 'Citadine', prix: 59, st: 'cloturer', lieu: '8 quai des Chartrons, Bordeaux', cli: 'c1' },
  { id: 'r3', h: '14:30', fin: '15:00', nom: 'Marc Dubreuil', presta: 'Extérieur express', veh: 'Berline', prix: 35, st: 'confirme', lieu: '3 avenue Thiers, Bastide', cli: 'c3' },
  { id: 'r4', h: '17:30', fin: '20:00', nom: 'Garage Renault Mérignac', presta: 'Forfait flotte · 3 véhicules', veh: 'Utilitaires', prix: 210, st: 'attente', lieu: '2 avenue de Mérignac, Mérignac', cli: 'c4' },
]

export const SEMAINE: JourSemaine[] = [
  { j: 'L', n: 12, rdv: [{ h: '09:00', fin: '10:15', nom: 'Claire Martin', presta: 'Lavage complet', prix: 65, st: 'termine' }] },
  { j: 'M', n: 13, rdv: [{ h: '09:30', fin: '10:15', nom: 'Nathalie Petit', presta: 'Intérieur', prix: 45, st: 'termine' }, { h: '15:00', fin: '15:30', nom: 'Antoine Faure', presta: 'Extérieur express', prix: 35, st: 'termine' }] },
  { j: 'M', n: 14, rdv: [{ h: '10:00', fin: '11:30', nom: 'Karim Benali', presta: 'Lavage complet SUV', prix: 79, st: 'termine' }] },
  { j: 'J', n: 15, rdv: [{ h: '14:00', fin: '15:30', nom: 'Julie Moreau', presta: 'Canapé 3 places', prix: 90, st: 'termine' }] },
  { j: 'V', n: 16, rdv: [{ h: '11:00', fin: '11:30', nom: 'Nadia Saïdi', presta: 'Extérieur express', prix: 35, st: 'termine' }, { h: '16:00', fin: '17:15', nom: 'Lucas Bernard', presta: 'Lavage complet', prix: 65, st: 'termine' }] },
  { j: 'S', n: 17, auj: true },
  { j: 'D', n: 18, rdv: [{ h: '10:00', fin: '10:30', nom: 'Sophie Lambert', presta: 'Extérieur express', prix: 35, st: 'attente' }] },
]

export const CLIENTS: Client[] = [
  { id: 'c1', nom: 'Camille Lefebvre', type: 'part', v: 3, ca: 177, der: 'il y a 5 semaines', veh: 'Peugeot 208', t: 3 },
  { id: 'c2', nom: 'Thomas Girard', type: 'part', v: 6, ca: 540, der: 'aujourd’hui', veh: 'Audi A3', t: 6 },
  { id: 'c3', nom: 'Marc Dubreuil', type: 'part', v: 2, ca: 70, der: 'il y a 2 mois', veh: 'Renault Mégane', t: 2 },
  { id: 'c4', nom: 'Garage Renault Mérignac', type: 'pro', v: 4, ca: 840, der: 'il y a 3 semaines', veh: 'Flotte · 3 utilitaires', t: 4, ent: true },
  { id: 'c5', nom: 'Sophie Lambert', type: 'part', v: 5, ca: 225, der: 'il y a 94 jours', veh: 'Toyota Yaris', t: 5, relance: true },
  { id: 'c6', nom: 'Nadia Saïdi', type: 'part', v: 4, ca: 180, der: 'hier', veh: 'Fiat 500', t: 4 },
  { id: 'c7', nom: 'Karim Benali', type: 'part', v: 3, ca: 237, der: 'mercredi', veh: 'Peugeot 3008', t: 3 },
  { id: 'c8', nom: 'Julie Moreau', type: 'part', v: 2, ca: 180, der: 'jeudi', veh: 'Canapé 3 places', t: 2 },
]

/** Encaissé jour par jour du 1er au 17 octobre. */
export const JOURS_MOIS = [96, 0, 145, 210, 80, 310, 0, 120, 65, 178, 0, 265, 190, 124, 79, 90, 155]

export const DEPENSES: Depense[] = [
  { l: 'Buse haute pression', c: 'Équipement · 15 oct.', p: 95 },
  { l: 'Plein, trajet Mérignac', c: 'Carburant · 15 oct.', p: 65 },
  { l: 'Produits de lavage', c: 'Produits · 14 oct.', p: 95 },
  { l: 'Microfibres ×10', c: 'Produits · 14 oct.', p: 45 },
]

export const SOURCES: [string, number][] = [['Instagram', 41], ['Google', 27], ['TikTok', 18], ['Bouche-à-oreille', 14]]
export const ENC_BASE = JOURS_MOIS.reduce((a, b) => a + b, 0)
export const DEP = 640

export const JOURS_NOMS = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.']

export const DOCS_BASE: Doc[] = [
  { n: 'F-00042', t: 'Facture', cli: 'Thomas Girard', p: 120, date: '17 oct.', st: 'Payée' },
  { n: 'D-00005', t: 'Devis', cli: 'Garage Renault Mérignac', p: 630, date: '15 oct.', st: 'En attente' },
  { n: 'F-00041', t: 'Facture', cli: 'Nadia Saïdi', p: 35, date: '16 oct.', st: 'Payée' },
  { n: 'F-00040', t: 'Facture', cli: 'Lucas Bernard', p: 65, date: '16 oct.', st: 'Émise' },
]

export const GUIDE: [string, string][] = [
  ['Comment fonctionne la carte de fidélité ?', 'Active-la dans Plus › Carte de fidélité, choisis le nombre de tampons et la récompense. Chaque prestation marquée « Terminé » ajoute un tampon, et ton client reçoit un email avec sa carte.'],
  ['Comment demander un acompte ?', 'Plus › Acompte : choisis le montant, le délai pour payer et ton lien (PayPal, Stripe, SumUp, Lydia, Wero ou virement). Si l’acompte n’est pas réglé à temps, le créneau se libère tout seul.'],
  ['Comment lancer une promotion ?', 'Plus › Promotions : une remise en % ou en €, sur une période, avec un bandeau et un compte à rebours sur ta page.'],
  ['Que se passe-t-il quand je marque un rendez-vous « Terminé » ?', 'La facture est créée, le tampon de fidélité tombe, et la demande d’avis Google part quelques heures plus tard. Un client pro reçoit sa facture par email ; un particulier la retrouve depuis son lien de confirmation.'],
  ['À quoi servent les créneaux groupés ?', 'Quand un client réserve près d’un rendez-vous que tu as déjà, les horaires juste avant ou après lui sont proposés en premier, avec ta remise si tu en as réglé une.'],
  ['Comment partager mon lien ?', 'Plus › Mes liens : un lien par réseau (Instagram, TikTok, Google). Tu sais ensuite d’où vient chaque réservation.'],
]

export const MISSIONS: [CleMission, string, string][] = [
  ['cloture', 'Clôture le rendez-vous de Camille', 'Agenda ou Aujourd’hui, rendez-vous de 11:30, puis « Marquer terminé ».'],
  ['fiche', 'Ouvre sa fiche client', 'Sa facture est dans l’historique, son tampon sur sa carte.'],
  ['chiffres', 'Regarde tes chiffres du mois', 'Les 59 € viennent de s’ajouter à l’encaissé.'],
  ['promo', 'Lance une promotion', 'Plus › Promotions. Le bandeau apparaît sur ta page de réservation, plus bas.'],
]

export const STATUTS: Record<StatutRdv, [string, string]> = {
  termine: ['Terminé', 'st-vert'],
  cloturer: ['À clôturer', 'st-ambre'],
  confirme: ['Confirmé', 'st-vert'],
  attente: ['En attente', 'st-ambre'],
}

/** Montant à la française, séparateur de milliers fixe : même rendu côté serveur et navigateur. */
export const eur = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`

export const ini = (n: string) => n.split(/\s+/).filter(Boolean).map(x => x[0]).slice(0, 2).join('').toUpperCase() || '?'

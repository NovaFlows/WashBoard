import type { Dictionnaire } from '../../traduire'

// Ajouter ou retirer une prestation sur un rendez-vous déjà pris (fiche du rendez-vous).
export const prestationsRdv: Dictionnaire = {
  'Prestation ajoutée.': 'Service added.',
  'Prestation retirée.': 'Service removed.',
  'Le client est prévenu par email.': 'The client has been notified by email.',
  'Ajouter ou retirer une prestation': 'Add or remove a service',
  'Prestations du rendez-vous': 'Services in this appointment',
  'Ajouter « {nom} »': 'Add “{nom}”',
  'Retirer « {nom} »': 'Remove “{nom}”',
  '{max} prestations au plus par rendez-vous.': '{max} services at most per appointment.',
  'Ajouter une prestation de votre catalogue': 'Add a service from your catalogue',
  'Aucune autre prestation dans votre catalogue.': 'No other service in your catalogue.',
  'En veille': 'Paused',
  'Prix :': 'Price:',
  'Fin prévue :': 'Expected end:',
  'Attention : le rendez-vous suivant commence à {heure}.': 'Careful: the next appointment starts at {heure}.',
}

// La timeline de la Fiche client — mélange prestations, demandes d'avis et relances dans un
// seul historique, comme le propose le canevas de Yanis (2026-09-28) plutôt que la seule liste
// de rendez-vous qu'affichait la fiche jusqu'ici.
//
// Deux précisions, PAS la même exactitude pour les deux automatismes — exactement le même écart
// que documente déjà `messagesAutomatiques.ts` (« RÈGLE D'OR : reproduire ce que le cron fait
// vraiment », et son propre aveu que l'avis, lui, se DÉDUIT) :
//
//  - la RELANCE se reproduit exactement (`relanceEstPartie`, `aReserveDepuis`, déjà exactes,
//    déjà testées) : on sait, sans deviner, si tel rendez-vous a porté une vraie relance et si
//    le client est revenu depuis ;
//  - l'AVIS est DÉDUIT : `review_request_sent_at` est posé aussi quand le cron écarte la
//    demande (avis désactivé entre-temps, pas de lien réglé) ou après un échec d'envoi. Cette
//    fiche ne connaît pas les réglages du laveur (ils ne sont pas chargés sur l'écran Clients),
//    elle ne filtre donc que ce qu'elle peut vérifier elle-même : un rendez-vous annulé ou sans
//    email n'a jamais pu partir. Le reste est affiché avec la réserve qu'il porte déjà ailleurs.
//
// Contrairement au canevas de Yanis, aucune note ni étoile n'accompagne l'avis : WashBoard n'est
// relié à aucune API Google qui lirait le contenu ou la note d'un avis réel — les inventer
// ferait passer une supposition pour un fait.

import { relanceEstPartie, aReserveDepuis, type RdvMessage } from './messagesAutomatiques'
import type { ClientBooking } from './clientProfile'

export type EvenementClient =
  | { type: 'prestation'; date: string; booking: ClientBooking }
  | { type: 'avis'; date: string }
  | { type: 'relance'; date: string; aReserveDepuis: boolean }

const nonVide = (s: string | null | undefined): boolean => !!s && s.trim().length > 0

/** Un rendez-vous a-t-il pu porter une VRAIE demande d'avis ? Seules les conditions vérifiables
 *  sans les réglages du laveur (voir l'en-tête du fichier). */
function avisPeutEtrePartie(b: ClientBooking): boolean {
  return b.status !== 'cancelled' && nonVide(b.client_email)
}

export function timelineClient(bookings: ClientBooking[]): EvenementClient[] {
  const messages = bookings as RdvMessage[]
  const evenements: EvenementClient[] = bookings.map(b => ({ type: 'prestation', date: b.scheduled_at, booking: b }))

  for (const b of bookings) {
    if (nonVide(b.review_request_sent_at) && avisPeutEtrePartie(b)) {
      evenements.push({ type: 'avis', date: b.review_request_sent_at! })
    }
    if (nonVide(b.followup_sent_at) && relanceEstPartie(b as RdvMessage, messages)) {
      evenements.push({ type: 'relance', date: b.followup_sent_at!, aReserveDepuis: aReserveDepuis(b as RdvMessage, messages) })
    }
  }

  return evenements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

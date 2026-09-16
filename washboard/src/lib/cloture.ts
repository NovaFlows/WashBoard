// Quand faut-il demander « Avez-vous fait ce rendez-vous ? » avant de le
// passer en « Terminé » ?
//
// La question existe parce que « Terminé » émet la facture : pour un créneau
// déjà passé qu'on n'a ni confirmé ni annulé, rien ne dit que la prestation a
// eu lieu. Elle est née sur l'accueil (`BookingList`), qui connaît la notion de
// créneau passé ; le calendrier, lui, ne l'avait pas — son bouton « Marquer
// terminé » s'affiche pour tout rendez-vous à venir comme passé.
//
// La règle vit donc ici, testée, plutôt que dupliquée dans deux écrans dont un
// de 1 500 lignes : c'est exactement la divergence qui avait laissé le
// calendrier sans protection (relevé par Ryan le 2026-09-15).

export type RendezVousAClore = {
  status: string
  scheduled_at: string
}

/** Le créneau est-il derrière nous ? */
export function estCreneauPasse(scheduledAt: string, maintenant: Date = new Date()): boolean {
  const debut = new Date(scheduledAt).getTime()
  return Number.isFinite(debut) && debut < maintenant.getTime()
}

/** Demander confirmation avant de clôturer ?
 *
 *  Oui pour un rendez-vous en attente ou confirmé dont le créneau est passé :
 *  c'est le cas où le laveur peut clôturer un rendez-vous qui n'a jamais eu
 *  lieu, et facturer un lavage qu'il n'a pas fait.
 *
 *  Non pour un rendez-vous à venir, qu'on termine sciemment (le laveur vient de
 *  finir, en avance) : lui poser la question à chaque fois serait un clic de
 *  plus pour rien. Non plus pour un rendez-vous déjà terminé ou annulé. */
export function doitDemanderConfirmation(
  rdv: RendezVousAClore,
  maintenant: Date = new Date(),
): boolean {
  if (rdv.status !== 'pending' && rdv.status !== 'confirmed') return false
  return estCreneauPasse(rdv.scheduled_at, maintenant)
}

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

import { addonsDuration, effectiveDuration } from '@/lib/pricing'

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
/** Ce qu'un rendez-vous AFFICHE dans l'application (PWA), qui n'est pas toujours son statut
 *  en base.
 *
 *  Un rendez-vous fait et clôturé après coup porte « Terminé », comme les autres : il n'y a
 *  rien à faire dessus, et l'orange d'un « Délai dépassé » définitif se lisait comme un
 *  problème sur une prestation faite et payée (Alexandre, 2026-09-26). L'orange est réservé à
 *  ce qui demande une action : un créneau FINI qu'on n'a ni clôturé ni annulé — « À clôturer ».
 *
 *  La colonne `closed_late` continue d'être écrite (trace de la clôture tardive, toujours
 *  affichée sur le site) : elle n'est simplement plus une couleur dans l'app.
 *
 *  On attend la FIN du créneau, pas son début : un lavage en cours n'est pas en retard. */
export type StatutAffiche = 'pending' | 'confirmed' | 'cancelled' | 'done' | 'a_cloturer'

export type RendezVousAffiche = {
  status: 'pending' | 'confirmed' | 'cancelled' | 'done'
  scheduled_at: string
  vehicle_count?: number | null
  selected_addons?: { duration_minutes?: number }[] | null
  services?: { duration_minutes?: number | null } | null
}

/** Fin prévue du créneau — même calcul que l'agenda (durée de la prestation, options
 *  comprises, multipliée par le nombre de véhicules). Durée inconnue : une heure. */
export function finCreneau(rdv: RendezVousAffiche): number {
  const debut = new Date(rdv.scheduled_at).getTime()
  if (!Number.isFinite(debut)) return Number.POSITIVE_INFINITY
  const minutes = effectiveDuration(
    (rdv.services?.duration_minutes ?? 60) + addonsDuration(rdv.selected_addons),
    rdv.vehicle_count,
  )
  return debut + minutes * 60_000
}

export function statutAffiche(rdv: RendezVousAffiche, maintenant: Date = new Date()): StatutAffiche {
  if (rdv.status !== 'pending' && rdv.status !== 'confirmed') return rdv.status
  return finCreneau(rdv) <= maintenant.getTime() ? 'a_cloturer' : rdv.status
}

export function doitDemanderConfirmation(
  rdv: RendezVousAClore,
  maintenant: Date = new Date(),
): boolean {
  if (rdv.status !== 'pending' && rdv.status !== 'confirmed') return false
  return estCreneauPasse(rdv.scheduled_at, maintenant)
}

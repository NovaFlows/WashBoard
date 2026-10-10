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

// ── Montant encaissé à la clôture ────────────────────────────────────────────
//
// Le client ne paie pas toujours le prix prévu (geste commercial, option ajoutée sur place,
// tapis en plus…). Sans moyen de le dire à la clôture, la facture et les Chiffres gardaient le
// prix de la réservation : faux, et sans recours (relevé par la maquette bureau, 2026-10-05).

/** Plafond de saisie : bien au-dessus de n'importe quel lavage, assez bas pour arrêter une
 *  faute de frappe (un zéro de trop) avant qu'elle ne parte sur une facture. */
export const MONTANT_ENCAISSE_MAX = 100_000

/** Ce que le client devait payer : le prix réservé, moins la remise « créneau optimisé ».
 *  Même formule que `revenuNet` (lib/pricing.ts), pour une seule réservation. */
export function montantPrevu(rdv: {
  booked_price?: number | null
  is_smart_slot?: boolean | null
  smart_discount?: number | null
  services?: { price?: number | null } | null
}): number {
  const prix = Number(rdv.booked_price ?? rdv.services?.price ?? 0)
  const remise = rdv.is_smart_slot ? Number(rdv.smart_discount ?? 0) : 0
  return Math.round(Math.max(0, prix - remise) * 100) / 100
}

/** Lit un montant saisi (« 45 », « 45,50 », « 45.5 ») : le nombre arrondi au centime, ou `null`
 *  s'il n'est pas utilisable (vide, négatif, au-delà du plafond, pas un nombre). */
export function lireMontant(saisie: unknown): number | null {
  const texte = typeof saisie === 'number' ? String(saisie) : typeof saisie === 'string' ? saisie : ''
  const propre = texte.trim().replace(/\s|€/g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(propre)) return null
  const n = Number(propre)
  return Number.isFinite(n) && n <= MONTANT_ENCAISSE_MAX ? Math.round(n * 100) / 100 : null
}

/** Colonnes à écrire quand le montant encaissé diffère du prévu. Le montant devient le prix
 *  réservé et la remise est remise à zéro : sinon `revenuNet` et la facture la retrancheraient
 *  une seconde fois d'un montant qui l'inclut déjà. `is_smart_slot` reste, c'est un fait
 *  historique (le créneau était bien optimisé). */
export function colonnesMontantEncaisse(montant: number): { booked_price: number; smart_discount: number } {
  return { booked_price: montant, smart_discount: 0 }
}

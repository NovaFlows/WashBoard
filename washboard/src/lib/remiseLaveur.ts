import { lireMontant, montantPrevu } from '@/lib/cloture'

// Remise accordée par le laveur sur un rendez-vous (demande de Ryan, 2026-11-15).
//
// `booked_price` devient le prix remisé : chiffres, acompte et total de facture le lisent déjà,
// sans rien recalculer ailleurs. `remise_laveur` garde la trace du montant retiré, pour afficher
// le prix de départ et la ligne « Remise » sur la facture. Seulement à la baisse.

const arrondi = (n: number) => Math.round(n * 100) / 100

export type RdvRemisable = {
  status: string
  facture_numero?: string | null
  booked_price?: number | null
  is_smart_slot?: boolean | null
  smart_discount?: number | null
  remise_laveur?: number | null
  acompte_montant?: number | null
  acompte_statut?: string | null
  services?: { price?: number | null } | null
}

export type VerdictRemise =
  | { ok: true; ancienPrix: number; nouveauPrix: number; colonnes: { booked_price: number; remise_laveur: number } }
  | { ok: false; statut: 400 | 409; erreur: string }

/** Prix avant toute remise du laveur (ce que le client voyait en réservant, ou le catalogue). */
export function prixAvantRemiseLaveur(rdv: RdvRemisable): number {
  return arrondi(montantPrevu(rdv) + Math.max(0, Number(rdv.remise_laveur ?? 0)))
}

export function appliquerRemiseLaveur(rdv: RdvRemisable, saisie: unknown): VerdictRemise {
  if (rdv.status === 'cancelled') return { ok: false, statut: 409, erreur: 'Un rendez-vous annulé ne se modifie plus.' }
  if (rdv.facture_numero) return { ok: false, statut: 409, erreur: 'La facture est déjà émise : le prix ne peut plus changer.' }
  const nouveauPrix = lireMontant(saisie)
  if (nouveauPrix === null) return { ok: false, statut: 400, erreur: 'Prix invalide.' }
  const ancienPrix = montantPrevu(rdv)
  if (nouveauPrix >= ancienPrix) {
    return { ok: false, statut: 400, erreur: `Le prix ne peut que baisser : il est actuellement de ${ancienPrix} €.` }
  }
  const acompte = rdv.acompte_statut ? Number(rdv.acompte_montant ?? 0) : 0
  if (acompte > 0 && nouveauPrix < acompte) {
    return { ok: false, statut: 409, erreur: `Le nouveau prix ne peut pas être inférieur à l’acompte (${acompte} €).` }
  }
  const remise = arrondi(ancienPrix - nouveauPrix)
  const prixReserve = Number(rdv.booked_price ?? rdv.services?.price ?? 0)
  return {
    ok: true,
    ancienPrix,
    nouveauPrix,
    colonnes: {
      booked_price: arrondi(prixReserve - remise),
      remise_laveur: arrondi(Math.max(0, Number(rdv.remise_laveur ?? 0)) + remise),
    },
  }
}

/** Rendez-vous saisi par le laveur : le prix qu'il tape, s'il est plus bas que le prix calculé,
 *  devient une remise. Plus haut, illisible ou absent : aucune remise, le prix calculé s'applique. */
export function remiseALaSaisie(prixCalcule: number, saisie: unknown): number {
  const prix = lireMontant(saisie)
  if (prix === null || prix >= prixCalcule) return 0
  return arrondi(prixCalcule - prix)
}

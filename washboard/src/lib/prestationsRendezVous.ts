import { montantPrevu } from '@/lib/cloture'
import { dureeTotale, optionsParVehicule, vehiclePrice } from '@/lib/pricing'
import {
  MAX_PRESTATIONS,
  idPrestationSupplementaire,
  idsPrestationsSupplementaires,
  optionDepuisPrestation,
  type PrestationCatalogue,
} from '@/lib/plusieursPrestations'
import type { ServiceAddon, VehicleItem } from '@/types'

// Prestation ajoutée ou retirée par le laveur sur un rendez-vous déjà pris (demande de Paint
// Étrier 77, 2026-11-20 : le client n'en avait coché qu'une, il en voulait deux).
//
// Même forme qu'une prestation choisie en ligne (lib/plusieursPrestations.ts) : une option
// `prestation:<id>` sur chaque véhicule, recopiée dans `selected_addons`. Prix, durée, détail du
// prix, emails et facture la lisent déjà. Seul l'écart de prix touche `booked_price` : promotion,
// fidélité et remise du laveur déjà appliquées restent ce qu'elles étaient.

const arrondi = (n: number) => Math.round(n * 100) / 100

export type RdvAvecPrestations = {
  status: string
  facture_numero?: string | null
  service_id?: string | null
  scheduled_at: string
  booked_price?: number | null
  is_smart_slot?: boolean | null
  smart_discount?: number | null
  acompte_montant?: number | null
  acompte_statut?: string | null
  vehicle_count?: number | null
  vehicle_type?: string | null
  vehicles_detail?: VehicleItem[] | null
  selected_addons?: ServiceAddon[] | null
  services?: { price?: number | null; duration_minutes?: number | null } | null
}

export type ColonnesPrestations = {
  booked_price: number
  vehicles_detail: VehicleItem[] | null
  selected_addons: ServiceAddon[]
  ends_at: string
}

export type VerdictPrestation =
  | { ok: true; ancienPrix: number; nouveauPrix: number; ecart: number; libelle: string; colonnes: ColonnesPrestations }
  | { ok: false; statut: 400 | 404 | 409; erreur: string }

/** Prestations ajoutées au rendez-vous (hors la principale), sans doublon. */
export function prestationsAjoutees(rdv: Pick<RdvAvecPrestations, 'vehicles_detail' | 'selected_addons'>): string[] {
  return idsPrestationsSupplementaires([...(rdv.vehicles_detail ?? []).flatMap(v => v.addons ?? []), ...(rdv.selected_addons ?? [])])
}

/** Le rendez-vous peut-il encore changer de prestations ? `null` si oui, sinon le refus. */
export function refusModification(rdv: Pick<RdvAvecPrestations, 'status' | 'facture_numero'>): { statut: 409; erreur: string } | null {
  if (rdv.status === 'cancelled') return { statut: 409, erreur: 'Un rendez-vous annulé ne se modifie plus.' }
  if (rdv.facture_numero) return { statut: 409, erreur: 'La facture est déjà émise : les prestations ne peuvent plus changer.' }
  return null
}

/** Véhicules au format « options par véhicule », ou `null` s'il faut rester sur la liste commune.
 *  Un rendez-vous saisi à la main a des véhicules sans options : il passe au format par véhicule.
 *  Un ancien rendez-vous avec des options communes garde sa liste : la convertir changerait la
 *  règle de prix de ses options (comptées une fois, et non par véhicule). */
function vehiculesParVehicule(rdv: RdvAvecPrestations): VehicleItem[] | null {
  const vehicules = rdv.vehicles_detail ?? []
  if (vehicules.length === 0) return null
  if (optionsParVehicule(vehicules)) return vehicules.map(v => ({ ...v, addons: v.addons ?? [] }))
  if ((rdv.selected_addons ?? []).length > 0) return null
  return vehicules.map(v => ({ ...v, addons: [] }))
}

const exemplaires = (v: { count?: number | null }) => Math.max(1, v.count ?? 1)

function finCreneau(rdv: RdvAvecPrestations, vehicules: VehicleItem[] | null, communes: ServiceAddon[]): string {
  const minutes = dureeTotale(rdv.services?.duration_minutes ?? 60, vehicules, communes, rdv.vehicle_count ?? 1)
  return new Date(new Date(rdv.scheduled_at).getTime() + minutes * 60_000).toISOString()
}

/** Ce que coûte la prestation sur ce rendez-vous : son prix pour chaque véhicule, une fois par
 *  exemplaire (une seule fois sur un ancien rendez-vous à options communes). */
export function prixAjout(rdv: RdvAvecPrestations, prestation: Pick<PrestationCatalogue, 'price' | 'vehicle_price_overrides'>): number {
  const vehicules = vehiculesParVehicule(rdv)
  if (vehicules) return arrondi(vehicules.reduce((s, v) => s + vehiclePrice(prestation, v.type) * exemplaires(v), 0))
  return arrondi(vehiclePrice(prestation, typeParDefaut(rdv)))
}

function typeParDefaut(rdv: RdvAvecPrestations): string {
  return rdv.vehicles_detail?.[0]?.type ?? rdv.vehicle_type ?? ''
}

function verdict(rdv: RdvAvecPrestations, ecart: number, libelle: string, vehicules: VehicleItem[] | null, communes: ServiceAddon[]): VerdictPrestation {
  const ancienPrix = montantPrevu(rdv)
  const prixReserve = Number(rdv.booked_price ?? rdv.services?.price ?? 0)
  const booked = arrondi(prixReserve + ecart)
  if (booked < 0) return { ok: false, statut: 409, erreur: 'Le prix deviendrait négatif : impossible de retirer cette prestation.' }
  const nouveauPrix = montantPrevu({ ...rdv, booked_price: booked })
  const acompte = rdv.acompte_statut ? Number(rdv.acompte_montant ?? 0) : 0
  if (ecart < 0 && acompte > 0 && nouveauPrix < acompte) {
    const erreur = rdv.acompte_statut === 'recu'
      ? `Impossible : le client a déjà versé un acompte de ${acompte} €, plus que le nouveau prix.`
      : `Impossible : l’acompte demandé (${acompte} €) dépasserait le nouveau prix.`
    return { ok: false, statut: 409, erreur }
  }
  return {
    ok: true,
    ancienPrix,
    nouveauPrix,
    ecart: arrondi(ecart),
    libelle,
    colonnes: { booked_price: booked, vehicles_detail: vehicules, selected_addons: communes, ends_at: finCreneau(rdv, vehicules, communes) },
  }
}

/** Ajoute une prestation du catalogue du laveur au rendez-vous. Le prix et la durée viennent du
 *  catalogue, jamais du navigateur. Une prestation en veille reste ajoutable : c'est le laveur
 *  qui la choisit, pas un client. */
export function ajouterPrestation(rdv: RdvAvecPrestations, prestation: PrestationCatalogue, washerId: string): VerdictPrestation {
  const refus = refusModification(rdv)
  if (refus) return { ok: false, ...refus }
  if (prestation.washer_id !== washerId) return { ok: false, statut: 404, erreur: 'Prestation introuvable.' }
  if (prestation.id === rdv.service_id) return { ok: false, statut: 409, erreur: `« ${prestation.name} » est déjà la prestation de ce rendez-vous.` }
  const deja = prestationsAjoutees(rdv)
  if (deja.includes(prestation.id)) return { ok: false, statut: 409, erreur: `« ${prestation.name} » est déjà sur ce rendez-vous.` }
  if (deja.length + 1 >= MAX_PRESTATIONS) return { ok: false, statut: 409, erreur: `${MAX_PRESTATIONS} prestations au plus par rendez-vous.` }

  const parVehicule = vehiculesParVehicule(rdv)
  if (parVehicule) {
    const ajoutees: ServiceAddon[] = []
    const vehicules = parVehicule.map(v => {
      const option = optionDepuisPrestation(prestation, v.type)
      ajoutees.push(option)
      return { ...v, addons: [...(v.addons ?? []), option] }
    })
    // `selected_addons` reste la liste à plat des options des véhicules, comme à la réservation :
    // l'agenda en tire la durée, la facture ses lignes.
    return verdict(rdv, prixAjout(rdv, prestation), prestation.name, vehicules, [...(rdv.selected_addons ?? []), ...ajoutees])
  }
  const option = optionDepuisPrestation(prestation, typeParDefaut(rdv))
  return verdict(rdv, Number(option.price ?? 0), prestation.name, rdv.vehicles_detail ?? null, [...(rdv.selected_addons ?? []), option])
}

/** Retire une prestation ajoutée (par le client ou le laveur). Le montant retiré est celui qui
 *  avait été compté, pas le prix actuel du catalogue, qui a pu changer depuis. */
export function retirerPrestation(rdv: RdvAvecPrestations, prestationId: string): VerdictPrestation {
  const refus = refusModification(rdv)
  if (refus) return { ok: false, ...refus }
  if (!prestationsAjoutees(rdv).includes(prestationId)) {
    return prestationId === rdv.service_id
      ? { ok: false, statut: 409, erreur: 'La prestation principale du rendez-vous ne se retire pas.' }
      : { ok: false, statut: 404, erreur: 'Cette prestation n’est pas sur ce rendez-vous.' }
  }
  const estCelle = (o: { id?: string | null }) => idPrestationSupplementaire(o) === prestationId
  let libelle = ''
  const noter = (o: ServiceAddon | undefined) => { if (o && !libelle) libelle = o.label }

  const avecOptions = optionsParVehicule(rdv.vehicles_detail)
  let ecart = 0
  const vehicules = avecOptions
    ? (rdv.vehicles_detail ?? []).map(v => {
        const retirees = (v.addons ?? []).filter(estCelle)
        noter(retirees[0])
        ecart -= retirees.reduce((s, o) => s + Number(o.price ?? 0), 0) * exemplaires(v)
        return Array.isArray(v.addons) ? { ...v, addons: v.addons.filter(o => !estCelle(o)) } : v
      })
    : rdv.vehicles_detail ?? null
  const communesAvant = rdv.selected_addons ?? []
  if (!avecOptions) {
    // Ancien format : les options communes comptent une fois chacune.
    const retirees = communesAvant.filter(estCelle)
    noter(retirees[0])
    ecart -= retirees.reduce((s, o) => s + Number(o.price ?? 0), 0)
  } else {
    noter(communesAvant.find(estCelle))
  }
  return verdict(rdv, ecart, libelle || 'Prestation', vehicules, communesAvant.filter(o => !estCelle(o)))
}

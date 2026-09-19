// Logique de prix — fonctions pures, testables (voir pricing.test.ts).
// Source de vérité utilisée par StepService, StepSlot, l'API bookings et les affichages.

export type PricedService = {
  price: number
  vehicle_price_overrides?: Record<string, number> | null
  vehicle_types?: string[] | null
}
export type SmartDiscount = { type: 'fixed' | 'percent'; value: number }

/** Prix d'un type de véhicule : surcharge si définie, sinon prix de base. */
export function vehiclePrice(service: PricedService, vehicleType: string): number {
  return service.vehicle_price_overrides?.[vehicleType] ?? service.price
}

/** Prix de chaque type RÉELLEMENT proposé par la prestation.
 *  Ignore les surcharges « orphelines » laissées par un type désélectionné
 *  (sinon elles fausseraient le « à partir de »). Sans types → prix de base. */
export function offeredTypePrices(service: PricedService): number[] {
  const types = service.vehicle_types ?? []
  if (types.length === 0) return [service.price]
  return types.map(t => vehiclePrice(service, t))
}

/** Vrai si un type proposé a un prix différent du prix de base. */
export function hasPriceOverrides(service: PricedService): boolean {
  return offeredTypePrices(service).some(p => p !== service.price)
}

/** Prix le plus bas parmi les types proposés (affichage « à partir de »).
 *  Un type à 0€ sert de repère « sur devis » (pas encore de tarif fixe,
 *  ex. un tapis à chiffrer au cas par cas) — l'ignorer pour ne pas afficher
 *  « à partir de 0€ » alors que les autres types ont un vrai prix. */
export function minVehiclePrice(service: PricedService): number {
  const prices = offeredTypePrices(service)
  const withRealPrice = prices.filter(p => p > 0)
  return Math.min(...(withRealPrice.length > 0 ? withRealPrice : prices))
}

/** Durée supplémentaire totale apportée par les options sélectionnées. */
export function addonsDuration(addons: { duration_minutes?: number }[] | null | undefined): number {
  return (addons ?? []).reduce((sum, a) => sum + (a.duration_minutes ?? 0), 0)
}

/** Durée réellement bloquée = (durée prestation + options) × nombre de véhicules (min 1).
 *
 *  ⚠️ Ne convient qu'aux réservations dont les options sont communes à tous les
 *  véhicules (ancien format). Pour un calcul valable dans les deux cas, passer
 *  par `dureeTotale`. */
export function effectiveDuration(durationMinutes: number, vehicleCount: number | null | undefined): number {
  return durationMinutes * Math.max(1, vehicleCount ?? 1)
}

// ── Options choisies véhicule par véhicule ─────────────────────────────────
//
// Jusqu'ici, une réservation portait UNE liste d'options valable pour toute la
// commande, et la durée la multipliait par le nombre de véhicules. Deux
// conséquences, constatées le 19/09 :
//
//   1. Un client qui réserve deux voitures et veut un nettoyage de vomi sur une
//      seule ne peut pas l'exprimer — et le paie deux fois en durée.
//   2. Le prix, lui, ne multipliait PAS les options (StepOptions les additionne
//      une fois). Le laveur facturait donc une option et en bloquait deux.
//
// Les options vivent désormais dans chaque véhicule de `vehicles_detail`. Les
// réservations déjà enregistrées n'en ont pas : elles doivent continuer à être
// lues comme avant, sinon on fausserait rétroactivement des factures déjà
// émises. D'où une seule règle, ici, qui reconnaît les deux formes.

export type OptionChoisie = { price?: number; duration_minutes?: number }

export type VehiculeReserve = {
  count?: number | null
  /** Options propres à CE véhicule. Absent = ancien format. */
  addons?: OptionChoisie[] | null
}

/** La réservation porte-t-elle des options rattachées à chaque véhicule ? */
export function optionsParVehicule(vehicules: VehiculeReserve[] | null | undefined): boolean {
  return (vehicules ?? []).some(v => Array.isArray(v.addons))
}

/** Durée totale bloquée par une réservation, dans l'un ou l'autre format. */
export function dureeTotale(
  dureePrestation: number,
  vehicules: VehiculeReserve[] | null | undefined,
  optionsCommunes: OptionChoisie[] | null | undefined,
  nombreVehicules: number | null | undefined,
): number {
  if (!optionsParVehicule(vehicules)) {
    return effectiveDuration(dureePrestation + addonsDuration(optionsCommunes), nombreVehicules)
  }
  return (vehicules ?? []).reduce((total, v) => {
    const exemplaires = Math.max(1, v.count ?? 1)
    return total + (dureePrestation + addonsDuration(v.addons)) * exemplaires
  }, 0)
}

/** Montant total des options, dans l'un ou l'autre format.
 *
 *  Ancien format : les options sont comptées UNE fois, quel que soit le nombre
 *  de véhicules — c'est ce que le client a vu et payé, on ne le réécrit pas. */
export function prixOptions(
  vehicules: VehiculeReserve[] | null | undefined,
  optionsCommunes: OptionChoisie[] | null | undefined,
  _nombreVehicules?: number | null,
): number {
  if (!optionsParVehicule(vehicules)) {
    return (optionsCommunes ?? []).reduce((t, o) => t + Number(o.price ?? 0), 0)
  }
  return (vehicules ?? []).reduce((total, v) => {
    const exemplaires = Math.max(1, v.count ?? 1)
    const parExemplaire = (v.addons ?? []).reduce((t, o) => t + Number(o.price ?? 0), 0)
    return total + parExemplaire * exemplaires
  }, 0)
}

/** Montant de la remise « créneau optimisé » pour un prix de base donné. */
export function smartDiscountAmount(basePrice: number, discount: SmartDiscount): number {
  return discount.type === 'percent' ? (basePrice * discount.value) / 100 : discount.value
}

/** Prix après remise « créneau optimisé » (jamais négatif). */
export function smartPrice(basePrice: number, discount: SmartDiscount): number {
  return Math.max(0, basePrice - smartDiscountAmount(basePrice, discount))
}

/** Prix affiché final : prix de base, diminué de la remise si le créneau est optimisé. */
export function finalDisplayPrice(basePrice: number, isSmartSlot: boolean, smartDiscount: number): number {
  return isSmartSlot ? Math.max(0, basePrice - smartDiscount) : basePrice
}

/** Formate un montant en euros : supprime les décimales inutiles (30.00 → "30€", 30.50 → "30.5€"). */
export function formatPrice(n: number): string {
  return n.toFixed(2).replace(/\.00$/, '') + '€'
}

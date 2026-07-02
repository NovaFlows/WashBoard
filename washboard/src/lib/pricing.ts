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

/** Prix le plus bas parmi les types proposés (affichage « à partir de »). */
export function minVehiclePrice(service: PricedService): number {
  return Math.min(...offeredTypePrices(service))
}

/** Durée réellement bloquée = durée prestation × nombre de véhicules (min 1). */
export function effectiveDuration(durationMinutes: number, vehicleCount: number | null | undefined): number {
  return durationMinutes * Math.max(1, vehicleCount ?? 1)
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

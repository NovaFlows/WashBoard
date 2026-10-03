// Résumés affichés par l'accordéon de réservation publique (`BookingForm`) :
// la ligne « Prestation ✓ — … » d'une section repliée, et le montant de la
// barre de prix persistante en bas d'écran.
//
// Fonctions pures, testables, et volontairement SÉPARÉES du calcul qui
// compte : le prix réellement facturé est toujours recalculé côté serveur à
// l'enregistrement (voir api/bookings/route.ts, « le prix ne vient jamais du
// navigateur »). Ce qui est ici n'est qu'un AFFICHAGE anticipé, au même titre
// que celui déjà fait par StepOptions et StepConfirmation.

import type { BookingFormData, Service } from '@/types'
import { hasPriceOverrides, minVehiclePrice, finalDisplayPrice } from '@/lib/pricing'
import { FUSEAU } from '@/lib/dateUtils'

export type FormeResumee = Partial<BookingFormData>

/** « Complet, 2 SUV, lustrage de la carrosserie » — ou `''` si rien n'est
 *  encore choisi. Sert de ligne de résumé une fois la section « Prestation »
 *  repliée. */
export function resumePrestation(form: FormeResumee, services: Service[]): string {
  const service = services.find(s => s.id === form.service_id)
  if (!service) return ''

  const bits: string[] = [service.name]

  const vehicules = form.vehicles_detail ?? []
  if (vehicules.length > 0) {
    // Un type par ligne distincte : « 2 SUV, 1 utilitaire » plutôt qu'un total
    // qui masquerait le mélange de types.
    const parType = new Map<string, number>()
    for (const v of vehicules) {
      const nom = v.label ?? v.type
      parType.set(nom, (parType.get(nom) ?? 0) + (v.count ?? 1))
    }
    for (const [nom, count] of parType) bits.push(`${count} ${nom}`)
  } else if (form.vehicle_count) {
    bits.push(`${form.vehicle_count} ${form.vehicle_type ?? ''}`.trim())
  }

  const addons = form.selected_addons ?? []
  // Dédupliqué : une option cochée sur deux véhicules ne doit apparaître
  // qu'une fois dans le résumé, qui ne dit pas « combien » mais « quoi ».
  const addonNames = [...new Set(addons.map(a => a.label.toLowerCase()))]
  bits.push(...addonNames)

  return bits.join(', ')
}

/** « jeu. 8 oct. à 14 h 00, 12 rue Mercière » — ou `''` si le créneau n'est
 *  pas encore choisi. */
export function resumeCreneau(form: FormeResumee): string {
  if (!form.scheduled_at) return ''
  const date = new Date(form.scheduled_at)
  const jour = date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: FUSEAU })
  const heure = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: FUSEAU })
  const adresse = form.address ? `, ${form.address}` : ''
  return `${jour} à ${heure}${adresse}`
}

/** Montant à afficher dans la barre persistante, avant même qu'une prestation
 *  soit choisie : le plus bas tarif du catalogue, pour un seul véhicule —
 *  jamais 0€, qui donnerait l'impression d'un lavage gratuit. `null` si le
 *  catalogue est vide (rien à afficher). */
export function montantMinimal(services: Service[]): number | null {
  if (services.length === 0) return null
  const prix = services.map(s => (hasPriceOverrides(s) ? minVehiclePrice(s) : s.price))
  return Math.min(...prix)
}

/** Montant estimé une fois une prestation choisie : prix de base (véhicules +
 *  options, déjà sommés dans `booked_price` par StepService/StepOptions) plus
 *  les frais de déplacement, moins la remise d'un créneau optimisé. */
export function montantEstime(form: FormeResumee): number {
  const base = form.booked_price ?? 0
  const avecDeplacement = base + (form.travel_fee ?? 0)
  return finalDisplayPrice(avecDeplacement, form.is_smart_slot ?? false, form.smart_discount ?? 0)
}

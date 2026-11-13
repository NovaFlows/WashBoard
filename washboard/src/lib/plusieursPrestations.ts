// Plusieurs prestations dans une même réservation (demande d'Alexandre, 2026-11-13, d'après un
// retour de Paint Étrier 77 : « pouvoir choisir plusieurs prestations, et pas seulement une »).
//
// Réglage du laveur (`washers.plusieurs_prestations`, éteint par défaut), dans l'écran Prestations.
//
// Choix de conception : la première prestation cochée reste LA prestation de la réservation
// (`service_id`, son nom, son prix de départ, ses restrictions de lieu et d'heures). Les suivantes
// voyagent comme des options de chaque véhicule (`vehicles_detail[].addons`), avec un identifiant
// préfixé `prestation:`. Ainsi le prix, la durée bloquée dans l'agenda, les e-mails, l'acompte, la
// facture et l'agenda du laveur les comptent déjà, sans nouvelle colonne en base.
//
// Le serveur ne croit jamais le navigateur : il relit chaque prestation supplémentaire en base
// (même laveur, type de véhicule proposé, réglage allumé) et en retire le prix, le nom et la durée.

import { vehiclePrice } from '@/lib/pricing'
import type { Service, ServiceAddon } from '@/types'

export const PREFIXE_PRESTATION = 'prestation:'
/** Catégorie portée par ces options : elle les distingue des options propres à une prestation. */
export const CATEGORIE_PRESTATION = 'prestation'
/** Au plus 6 prestations d'un coup : au-delà, c'est une erreur ou un abus. */
export const MAX_PRESTATIONS = 6

type OptionIdentifiable = { id?: string | null }

/** L'option est-elle une prestation supplémentaire (et non une option de la prestation) ? */
export function estPrestationSupplementaire(option: OptionIdentifiable): boolean {
  return typeof option.id === 'string' && option.id.startsWith(PREFIXE_PRESTATION) && option.id.length > PREFIXE_PRESTATION.length
}

/** L'identifiant de la prestation derrière l'option, ou `null`. */
export function idPrestationSupplementaire(option: OptionIdentifiable): string | null {
  return estPrestationSupplementaire(option) ? String(option.id).slice(PREFIXE_PRESTATION.length) : null
}

/** La prestation, sous forme d'option d'un véhicule d'un certain type (au prix de ce type). */
export function optionDepuisPrestation(service: Pick<Service, 'id' | 'name' | 'price' | 'vehicle_price_overrides' | 'duration_minutes'>, typeVehicule: string): ServiceAddon {
  return {
    id: PREFIXE_PRESTATION + service.id,
    label: service.name,
    price: vehiclePrice(service, typeVehicule),
    category: CATEGORIE_PRESTATION,
    duration_minutes: service.duration_minutes,
  }
}

/** Les options d'un véhicule sans les prestations supplémentaires : celles de la prestation. */
export function optionsDeLaPrestation<T extends OptionIdentifiable>(options: T[] | null | undefined): T[] {
  return (options ?? []).filter(o => !estPrestationSupplementaire(o))
}

/** Les identifiants des prestations supplémentaires d'une liste d'options, sans doublon. */
export function idsPrestationsSupplementaires(options: OptionIdentifiable[] | null | undefined): string[] {
  return [...new Set((options ?? []).map(idPrestationSupplementaire).filter((id): id is string => !!id))]
}

/** Les prestations cochées, dans l'ordre : la principale, puis les supplémentaires. */
export function prestationsChoisies(
  serviceId: string | null | undefined,
  vehicules: { addons?: OptionIdentifiable[] | null }[] | null | undefined,
): string[] {
  const supp = idsPrestationsSupplementaires((vehicules ?? []).flatMap(v => v.addons ?? []))
  return [...new Set([...(serviceId ? [serviceId] : []), ...supp])]
}

/** Types de véhicule que TOUTES les prestations données proposent. */
export function typesCommuns(services: Pick<Service, 'vehicle_types'>[]): string[] {
  if (services.length === 0) return []
  return services[0].vehicle_types.filter(t => services.every(s => s.vehicle_types.includes(t)))
}

/**
 * Coche ou décoche une prestation. Rend la nouvelle liste ordonnée : la première est la
 * principale ; décocher la principale fait passer la suivante en tête. Au-delà de
 * `MAX_PRESTATIONS`, on n'ajoute plus.
 */
export function basculerPrestation(actuelles: string[], id: string): string[] {
  if (actuelles.includes(id)) return actuelles.filter(x => x !== id)
  return actuelles.length >= MAX_PRESTATIONS ? actuelles : [...actuelles, id]
}

export type PrestationCatalogue = Pick<Service, 'id' | 'name' | 'price' | 'vehicle_price_overrides' | 'duration_minutes' | 'vehicle_types'> & {
  washer_id: string
  en_veille?: boolean | null
}

type VehiculeRecu = { type: string; addons?: ServiceAddon[] | null }

/**
 * Côté serveur : remplace chaque prestation supplémentaire reçue du navigateur par ce que dit le
 * catalogue (nom, prix du type, durée). Refuse tout ce qui ne tient pas : réglage du laveur éteint,
 * prestation d'un autre laveur, en veille, inconnue, ou non proposée pour le type du véhicule.
 *
 * `vehicules` porte les options par véhicule ; `communes` l'ancienne liste commune à la commande
 * (rendue telle quelle si elle n'a pas de prestation supplémentaire).
 */
export function normaliserPrestationsSupplementaires<V extends VehiculeRecu>(args: {
  vehicules: V[] | undefined
  communes: ServiceAddon[] | undefined
  catalogue: Map<string, PrestationCatalogue>
  washerId: string
  principaleId: string
  autorise: boolean
  /** Type utilisé pour les options communes (ancien format, sans véhicule détaillé). */
  typeParDefaut: string
}): { ok: true; vehicules: V[] | undefined; communes: ServiceAddon[] | undefined } | { ok: false; message: string } {
  const { vehicules, communes, catalogue, washerId, principaleId, autorise, typeParDefaut } = args
  const ids = idsPrestationsSupplementaires([...(vehicules ?? []).flatMap(v => v.addons ?? []), ...(communes ?? [])])
  if (ids.length === 0) return { ok: true, vehicules, communes }
  if (!autorise) return { ok: false, message: 'Ce prestataire ne propose pas de choisir plusieurs prestations.' }
  if (ids.length > MAX_PRESTATIONS - 1) return { ok: false, message: `Vous pouvez choisir ${MAX_PRESTATIONS} prestations au plus.` }
  for (const id of ids) {
    const s = catalogue.get(id)
    if (!s || s.washer_id !== washerId || s.en_veille === true || id === principaleId) {
      return { ok: false, message: 'Une des prestations choisies n’est plus proposée.' }
    }
  }
  const refaire = (options: ServiceAddon[] | null | undefined, type: string): { ok: true; options: ServiceAddon[] } | { ok: false; message: string } => {
    const sortie: ServiceAddon[] = []
    const vues = new Set<string>()
    for (const o of options ?? []) {
      const id = idPrestationSupplementaire(o)
      if (!id) { sortie.push(o); continue }
      if (vues.has(id)) continue
      vues.add(id)
      const s = catalogue.get(id)!
      if (!s.vehicle_types.includes(type)) return { ok: false, message: `« ${s.name} » n’est pas proposée pour ce type de véhicule.` }
      sortie.push(optionDepuisPrestation(s, type))
    }
    return { ok: true, options: sortie }
  }
  const vehiculesSures: V[] = []
  for (const v of vehicules ?? []) {
    const r = refaire(v.addons, v.type)
    if (!r.ok) return r
    vehiculesSures.push({ ...v, addons: r.options })
  }
  const rc = refaire(communes, typeParDefaut)
  if (!rc.ok) return rc
  return { ok: true, vehicules: vehicules ? vehiculesSures : undefined, communes: communes ? rc.options : undefined }
}

/**
 * Écrit les prestations choisies dans les véhicules : la première en prestation de la
 * réservation, les autres en options de chaque véhicule (au prix de son type). Les options
 * propres à la prestation principale déjà cochées sont conservées si elle n'a pas changé.
 * Les véhicules d'un type que l'une des prestations ne propose pas ne sont pas touchés ici :
 * c'est à l'appelant de ne laisser cocher que des prestations compatibles.
 */
export function appliquerPrestations<V extends { type: string; addons?: ServiceAddon[] }>(
  ordre: Pick<Service, 'id' | 'name' | 'price' | 'vehicle_price_overrides' | 'duration_minutes' | 'addons'>[],
  vehicules: V[],
  principaleAvant?: string,
): { service_id: string; vehicules: V[] } {
  const [principale, ...autres] = ordre
  if (!principale) return { service_id: '', vehicules: vehicules.map(v => ({ ...v, addons: [] })) }
  const garder = principaleAvant === principale.id
  return {
    service_id: principale.id,
    vehicules: vehicules.map(v => ({
      ...v,
      addons: [
        ...(garder ? optionsDeLaPrestation(v.addons).filter(a => principale.addons.some(x => x.id === a.id)) : []),
        ...autres.map(s => optionDepuisPrestation(s, v.type)),
      ],
    })),
  }
}

// ── Restrictions combinées ────────────────────────────────────────────────
//
// Chaque prestation peut être limitée à un lieu (domicile / centre), à des heures de début et à
// certains centres. Quand le client en cumule plusieurs, la réservation doit respecter TOUTES
// leurs limites : la combinaison est l'intersection, et elle est impossible si elle est vide
// (une prestation « déplacement seulement » ne se cumule pas avec une « centre seulement »).

type Lieu = 'domicile' | 'centre'
type Limites = { lieu_restreint?: Lieu | null; heures_debut?: string[] | null; centres_ids?: string[] | null }

/** Intersection de listes dont `null` ou vide = « pas de limite ». `null` rendu = pas de limite. */
function croiser(listes: (readonly string[] | null | undefined)[]): { ok: true; liste: string[] | null } | { ok: false } {
  let courante: string[] | null = null
  for (const l of listes) {
    if (!l || l.length === 0) continue
    courante = courante === null ? [...new Set(l)] : courante.filter(x => l.includes(x))
    if (courante.length === 0) return { ok: false }
  }
  return { ok: true, liste: courante }
}

/** Limites cumulées de plusieurs prestations, ou `null` si aucune réservation ne les respecte toutes. */
export function limitesCombinees(prestations: Limites[]): { lieu: Lieu | null; heures: string[] | null; centres: string[] | null } | null {
  const lieux = croiser(prestations.map(p => p.lieu_restreint ? [p.lieu_restreint] : null))
  const heures = croiser(prestations.map(p => p.heures_debut))
  const centres = croiser(prestations.map(p => p.centres_ids))
  if (!lieux.ok || !heures.ok || !centres.ok) return null
  return { lieu: (lieux.liste?.[0] as Lieu | undefined) ?? null, heures: heures.liste, centres: centres.liste }
}

/** Peut-on cumuler ces prestations dans une même réservation ? */
export function prestationsCompatibles(prestations: Limites[]): boolean {
  return limitesCombinees(prestations) !== null
}

// Ce que le laveur lit dans l'agenda pour un rendez-vous : le nom de toutes les prestations
// réservées et le détail complet du prix (2026-11-13, retour d'Alexandre : avec plusieurs
// prestations, la ligne n'en nommait qu'une et le détail ne montrait que les options).
//
// Les prestations supplémentaires (lib/plusieursPrestations.ts) sont enregistrées comme options de
// chaque véhicule ; ici on les relit pour ce qu'elles sont : des prestations.

import { optionsParVehicule } from '@/lib/pricing'
import { estPrestationSupplementaire } from '@/lib/plusieursPrestations'
import type { ServiceAddon, VehicleItem } from '@/types'

type Reservation = {
  services?: { name: string } | null
  vehicles_detail?: VehicleItem[] | null
  selected_addons?: ServiceAddon[] | null
  travel_fee?: number | null
}

export type LigneDetail = { cle: string; libelle: string; montant: number; genre: 'principale' | 'prestation' | 'option' | 'deplacement' }

/** Options choisies, une entrée par option avec le nombre de véhicules qui la portent. */
function optionsChoisies(b: Reservation): { option: ServiceAddon; fois: number }[] {
  const vehicules = b.vehicles_detail ?? []
  const brutes = optionsParVehicule(vehicules)
    ? vehicules.flatMap(v => (v.addons ?? []).map(option => ({ option, fois: Math.max(1, v.count ?? 1) })))
    : (b.selected_addons ?? []).map(option => ({ option, fois: 1 }))
  const regroupees = new Map<string, { option: ServiceAddon; fois: number }>()
  for (const { option, fois } of brutes) {
    const cle = option.id ?? option.label
    const deja = regroupees.get(cle)
    regroupees.set(cle, { option, fois: (deja?.fois ?? 0) + fois })
  }
  return [...regroupees.values()]
}

/** Les noms de toutes les prestations : la principale, puis les supplémentaires. */
export function nomsPrestations(b: Reservation): string[] {
  const principale = b.services?.name
  const supplementaires = optionsChoisies(b).filter(o => estPrestationSupplementaire(o.option)).map(o => o.option.label)
  return [...(principale ? [principale] : []), ...supplementaires]
}

/** Détail du prix, ligne par ligne : prestation, prestations ajoutées, options, déplacement. */
export function lignesDetailPrix(b: Reservation): LigneDetail[] {
  const lignes: LigneDetail[] = []
  const vehicules = b.vehicles_detail ?? []
  const nombre = vehicules.reduce((n, v) => n + Math.max(1, v.count ?? 1), 0)
  if (b.services && vehicules.length > 0) {
    lignes.push({
      cle: 'principale',
      libelle: nombre > 1 ? `${b.services.name} × ${nombre}` : b.services.name,
      montant: vehicules.reduce((s, v) => s + Number(v.unit_price ?? 0) * Math.max(1, v.count ?? 1), 0),
      genre: 'principale',
    })
  }
  const choisies = optionsChoisies(b)
  for (const genre of ['prestation', 'option'] as const) {
    for (const { option, fois } of choisies) {
      if (estPrestationSupplementaire(option) !== (genre === 'prestation')) continue
      lignes.push({
        cle: `${genre}:${option.id ?? option.label}`,
        libelle: fois > 1 ? `${option.label} × ${fois}` : option.label,
        montant: Number(option.price ?? 0) * fois,
        genre,
      })
    }
  }
  if (Number(b.travel_fee ?? 0) > 0) {
    lignes.push({ cle: 'deplacement', libelle: 'Frais de déplacement', montant: Number(b.travel_fee), genre: 'deplacement' })
  }
  return lignes
}

/** Y a-t-il quelque chose à détailler au-delà de la prestation seule ? */
export function detailUtile(lignes: LigneDetail[]): boolean {
  return lignes.some(l => l.genre !== 'principale')
}

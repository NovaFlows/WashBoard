/** Règles d'une prestation valide, partagées par le formulaire du tableau de
 *  bord, les routes `/api/services` et la page de réservation publique.
 *
 *  Le piège qu'elles ferment : une prestation sans aucun type (Citadine, SUV,
 *  Canapé 3 places…) s'enregistrait sans avertissement. Côté client, elle
 *  s'affichait, se sélectionnait… puis n'offrait rien à ajouter, et le bouton
 *  Continuer restait grisé sans explication : une impasse sur la page de
 *  réservation. Constaté chez un inscrit qui avait tout configuré sauf ça. */

/** Une prestation ne se réserve qu'avec au moins un type : c'est ce que le
 *  client choisit et compte (« 2 SUV »), et ce qui fixe le prix. */
export function estReservable(s: { vehicle_types?: unknown }): boolean {
  return Array.isArray(s.vehicle_types) && s.vehicle_types.length > 0
}

export type ChampPrestation = 'nom' | 'prix' | 'duree' | 'type'

/** Ce qui manque pour enregistrer, dans l'ordre du formulaire. */
export function champsManquants(p: {
  name: string
  price: string
  duration_minutes: string
  vehicle_types: string[]
}): ChampPrestation[] {
  const manques: ChampPrestation[] = []
  if (!p.name.trim()) manques.push('nom')
  if (p.price === '') manques.push('prix')
  if (!p.duration_minutes || Number(p.duration_minutes) <= 0) manques.push('duree')
  if (!estReservable(p)) manques.push('type')
  return manques
}

const LIBELLES: Record<ChampPrestation, string> = {
  nom: 'le nom',
  prix: 'le prix',
  duree: 'la durée',
  type: 'au moins un type',
}

/** Phrase affichée sous le bouton Enregistrer quand il est grisé — sans elle,
 *  le laveur ne sait pas ce que le formulaire attend. */
export function messageManques(manques: ChampPrestation[]): string | null {
  if (manques.length === 0) return null
  const liste = manques.map(c => LIBELLES[c])
  const texte = liste.length === 1
    ? liste[0]
    : `${liste.slice(0, -1).join(', ')} et ${liste[liste.length - 1]}`
  return `Pour enregistrer, il manque ${texte}.`
}

/** Refus serveur : même message que l'écran, pour qui passerait à côté. */
export const ERREUR_SANS_TYPE =
  'Cochez au moins un type : sans type, vos clients ne peuvent pas réserver cette prestation.'

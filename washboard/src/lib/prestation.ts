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

export type ChampPrestation = 'nom' | 'prix' | 'duree' | 'type' | 'duree_max'

/** Au-delà, une prestation ne peut plus jamais aboutir à un créneau : sa
 *  durée dépasse toute plage d'ouverture plausible. Repéré après
 *  l'enregistrement d'une prestation à 5000 minutes (~83h) — le formulaire
 *  posait un `step="15"` mais aucun plafond, et le client serait tombé sur
 *  le message « ne rentre dans aucun horaire » (voir `slots.ts`) sans que le
 *  laveur comprenne jamais pourquoi. */
export const DUREE_MAX_MINUTES = 480

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
  else if (Number(p.duration_minutes) > DUREE_MAX_MINUTES) manques.push('duree_max')
  if (!estReservable(p)) manques.push('type')
  return manques
}

const LIBELLES: Record<'nom' | 'prix' | 'duree' | 'type', string> = {
  nom: 'le nom',
  prix: 'le prix',
  duree: 'la durée',
  type: 'au moins un type',
}

/** Phrase affichée sous le bouton Enregistrer quand il est grisé — sans elle,
 *  le laveur ne sait pas ce que le formulaire attend.
 *
 *  `duree_max` n'est volontairement pas de ce ressort : ce champ N'EST PAS
 *  manquant, il est renseigné mais trop grand. Le fondre dans « il manque
 *  une durée de 8h maximum » (essayé, puis retiré) se lisait comme l'inverse
 *  du sens voulu — une exigence de durée minimale. Il a son propre message,
 *  voir `ERREUR_DUREE_MAX`, affiché séparément par l'appelant. */
export function messageManques(manques: ChampPrestation[]): string | null {
  const reels = manques.filter((c): c is keyof typeof LIBELLES => c !== 'duree_max')
  if (reels.length === 0) return null
  const liste = reels.map(c => LIBELLES[c])
  const texte = liste.length === 1
    ? liste[0]
    : `${liste.slice(0, -1).join(', ')} et ${liste[liste.length - 1]}`
  return `Pour enregistrer, il manque ${texte}.`
}

/** Refus serveur : même message que l'écran, pour qui passerait à côté. */
export const ERREUR_SANS_TYPE =
  'Cochez au moins un type : sans type, vos clients ne peuvent pas réserver cette prestation.'

/** Refus serveur d'une durée déraisonnable — même plafond que le formulaire
 *  (`DUREE_MAX_MINUTES`), pour qui l'atteindrait par un appel direct. */
export const ERREUR_DUREE_MAX =
  `La durée doit être comprise entre 1 et ${DUREE_MAX_MINUTES} minutes (${DUREE_MAX_MINUTES / 60}h).`

/** Durée utilisable pour une prestation : positive et sous le plafond. */
export function dureeValide(minutes: number): boolean {
  return Number.isFinite(minutes) && minutes > 0 && minutes <= DUREE_MAX_MINUTES
}

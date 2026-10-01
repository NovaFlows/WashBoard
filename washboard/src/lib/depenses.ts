// Dépenses du laveur : catégories, mises en forme et vérifications de saisie. Fonctions
// pures, partagées par l'écran du site (`ComptaDashboard`, qui les réexporte) et par l'écran
// « Dépenses » de la PWA (`DepensesV2`) — une seule liste de catégories, pour que les deux
// présentations d'une même donnée ne divergent jamais.

export type Depense = {
  id: string
  date: string
  category: string
  label: string
  amount: number
  recurring_expense_id?: string | null
}

export type DepenseRecurrente = {
  id: string
  category: string
  label: string
  amount: number
  day_of_month: number
  active: boolean
}

export const CATEGORIES_DEPENSE = [
  { value: 'carburant', label: 'Carburant' },
  { value: 'produits', label: 'Produits' },
  { value: 'equipement', label: 'Équipement' },
  { value: 'abonnement', label: 'Abonnements' },
  { value: 'autre', label: 'Autre' },
] as const

export type CategorieDepense = typeof CATEGORIES_DEPENSE[number]['value']

/** Libellé d'une catégorie ; une valeur inconnue (ancienne ligne) s'affiche telle quelle
 *  plutôt que de disparaître. */
export function libelleCategorie(valeur: string): string {
  return CATEGORIES_DEPENSE.find(c => c.value === valeur)?.label ?? valeur
}

export function totalDepenses(depenses: { amount: number | string }[]): number {
  return depenses.reduce((s, d) => s + (Number(d.amount) || 0), 0)
}

/** « 12 sept. » — midi pour que le fuseau ne fasse pas reculer la date d'un jour. */
export function jourCourt(date: string): string {
  const d = new Date(`${date}T12:00:00`)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

/** `null` si la saisie passe, sinon la phrase à afficher. Mêmes règles que le serveur
 *  (`POST /api/expenses`) : libellé, montant positif, date. */
export function validerDepense(champs: { label: string; amount: string; date: string }): string | null {
  if (!champs.label.trim()) return 'Donnez un libellé à ce frais (« Plein essence », par exemple).'
  const montant = Number(String(champs.amount).replace(',', '.'))
  if (!Number.isFinite(montant) || montant <= 0) return 'Le montant doit être un nombre supérieur à zéro.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(champs.date)) return 'Choisissez une date.'
  return null
}

/** Le montant tel qu'il part au serveur : la virgule française est acceptée à la saisie. */
export function montantNombre(saisie: string): number {
  return Number(String(saisie).replace(',', '.'))
}

export function validerRecurrent(champs: { label: string; amount: string; day_of_month: string }): string | null {
  const base = validerDepense({ label: champs.label, amount: champs.amount, date: '2000-01-01' })
  if (base) return base
  const jour = Number(champs.day_of_month)
  if (!Number.isInteger(jour) || jour < 1 || jour > 28) {
    // 28 : le 29, 30 ou 31 n'existe pas tous les mois, le frais sauterait certains mois.
    return 'Le jour du mois doit être entre 1 et 28.'
  }
  return null
}

/** « le 1er de chaque mois », « le 15 de chaque mois ». */
export function libelleJourDuMois(jour: number): string {
  return `le ${jour === 1 ? '1er' : jour} de chaque mois`
}

// Règles de calcul du chiffre d'affaires, extraites de `CrmDashboard.tsx` où
// elles n'étaient pas testées — alors qu'elles décident quelles réservations
// comptent dans le CA du laveur et à quel montant.

export type RevenueBooking = {
  status: string
  closed_late?: boolean | null
  booked_price?: number | null
  services?: { price: number } | null
}

/** Statut d'affichage : une clôture tardive est distinguée du statut brut,
 *  pour que le laveur voie ses retards plutôt qu'un « terminé » trompeur. */
export function getStatusKey(b: Pick<RevenueBooking, 'status' | 'closed_late'>): string {
  return b.closed_late ? 'closed_late' : b.status
}

/** La réservation compte-t-elle dans le chiffre d'affaires ?
 *
 *  `confirmed` compte au même titre que `done` : le CA affiché inclut donc le
 *  prévisionnel accepté, pas seulement l'encaissé. C'est un choix produit
 *  assumé (le laveur veut voir ce qui l'attend), pas un oubli — d'où ce test
 *  qui le fige explicitement. */
export function comptePourLeCA(b: Pick<RevenueBooking, 'status'>): boolean {
  return b.status === 'confirmed' || b.status === 'done'
}

/** Montant retenu : le prix réellement facturé s'il existe, sinon le tarif
 *  courant de la prestation. Sans repli, une prestation supprimée ferait
 *  disparaître le CA des réservations passées. */
export function effectivePrice(b: RevenueBooking): number {
  return b.booked_price ?? b.services?.price ?? 0
}

/** Chiffre d'affaires d'un ensemble de réservations. */
export function totalRevenue(bookings: RevenueBooking[]): number {
  return bookings.filter(comptePourLeCA).reduce((somme, b) => somme + effectivePrice(b), 0)
}

const MOIS_COURTS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

/** Les six derniers mois, du plus ancien au plus récent, pour l'histogramme. */
export function getLast6Months(now: Date = new Date()): { year: number; month: number; label: string }[] {
  const resultat = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    resultat.push({ year: d.getFullYear(), month: d.getMonth(), label: MOIS_COURTS[d.getMonth()] })
  }
  return resultat
}

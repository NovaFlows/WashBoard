// Fiche client : agrège les réservations d'un même client pour en tirer un
// historique et quelques chiffres. Le CRM charge déjà toutes les réservations,
// on ne refait donc aucune requête — c'est du calcul pur, donc testable.
//
// Le regroupement se fait sur l'email : c'est le seul champ obligatoire et
// stable. Le nom varie d'une réservation à l'autre (« Alex », « Alexandre B. »)
// et ne peut pas servir de clé.

export type ClientBooking = {
  id: string
  client_name: string
  client_email: string
  client_phone: string
  address: string
  scheduled_at: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'done'
  closed_late: boolean
  booked_price: number | null
  is_professional: boolean
  company_name: string | null
  services: { name: string; price: number; duration_minutes: number } | null
}

export type ClientProfile = {
  email: string
  /** Nom de la réservation la plus récente : c'est la graphie la plus à jour. */
  name: string
  phone: string
  isProfessional: boolean
  companyName: string | null
  /** Adresses distinctes utilisées, la plus récente en premier. */
  addresses: string[]
  /** Réservations du client, de la plus récente à la plus ancienne. */
  bookings: ClientBooking[]
  /** Chiffre d'affaires des rendez-vous honorés (confirmés ou terminés). */
  totalRevenue: number
  honoredCount: number
  cancelledCount: number
  averageBasket: number
  firstVisit: string | null
  lastVisit: string | null
  /** Jours depuis le dernier rendez-vous honoré — sert à repérer qui relancer. */
  daysSinceLastVisit: number | null
}

const isHonored = (b: ClientBooking) => b.status === 'confirmed' || b.status === 'done'
const priceOf = (b: ClientBooking) => b.booked_price ?? b.services?.price ?? 0

export function buildClientProfile(
  bookings: ClientBooking[],
  email: string,
  now: Date = new Date(),
): ClientProfile | null {
  const key = email.trim().toLowerCase()
  const mine = bookings
    .filter(b => b.client_email?.trim().toLowerCase() === key)
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())

  if (mine.length === 0) return null

  const latest = mine[0]
  const honored = mine.filter(isHonored)
  const totalRevenue = honored.reduce((sum, b) => sum + priceOf(b), 0)

  // Les dates de visite ne comptent que les RDV honorés : un rendez-vous annulé
  // n'est pas une visite, et le faire compter fausserait toute relance.
  const honoredDates = honored.map(b => b.scheduled_at).sort()
  const lastVisit = honoredDates.length ? honoredDates[honoredDates.length - 1] : null

  return {
    email: latest.client_email,
    name: latest.client_name,
    phone: mine.find(b => b.client_phone)?.client_phone ?? '',
    isProfessional: latest.is_professional,
    companyName: latest.company_name,
    addresses: [...new Set(mine.map(b => b.address).filter(Boolean))],
    bookings: mine,
    totalRevenue,
    honoredCount: honored.length,
    cancelledCount: mine.filter(b => b.status === 'cancelled').length,
    averageBasket: honored.length ? Math.round(totalRevenue / honored.length) : 0,
    firstVisit: honoredDates.length ? honoredDates[0] : null,
    lastVisit,
    daysSinceLastVisit: lastVisit
      ? Math.floor((now.getTime() - new Date(lastVisit).getTime()) / 86_400_000)
      : null,
  }
}

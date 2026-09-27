// Fiche client : agrège les réservations d'un même client pour en tirer un
// historique et quelques chiffres. Le CRM charge déjà toutes les réservations,
// on ne refait donc aucune requête — c'est du calcul pur, donc testable.
//
// Le regroupement se fait sur l'email quand il existe : c'est le champ le plus
// stable (le nom varie d'une réservation à l'autre — « Alex », « Alexandre B. »
// — et ne peut pas servir de clé).
//
// Depuis le 2026-09-27 (demande d'Alexandre), un client peut aussi naître d'un
// DEVIS ou d'une FACTURE écrits à la main, sans aucune réservation : « un client
// comme un autre ». Deux conséquences :
//
//  - un devis ne porte parfois qu'un téléphone. La clé est donc l'email, ou à
//    défaut le téléphone sous sa forme canonique, préfixé `tel:` ;
//  - une FACTURE écrite à la main est un travail fait et payé : elle compte
//    dans le chiffre d'affaires du client et dans son nombre de prestations. Un
//    DEVIS, non — il n'engage encore personne.
//
// Les documents sont un paramètre FACULTATIF : sans eux, cette fiche se calcule
// exactement comme avant (le CRM du site, `chiffresClients`, « Proposer ce
// créneau » n'en passent pas et ne bougent donc pas d'un chiffre).

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

/** Ce qu'un document apporte à une fiche client. Forme minimale voulue : elle évite de faire
 *  dépendre ce calcul, partagé avec le CRM du site, de tout `lib/documents.ts`. */
export type ClientDocument = {
  id: string
  genre: 'devis' | 'facture'
  numero: string | null
  statut: string
  emis_le: string | null
  created_at: string
  contenu: {
    client: { nom: string; email: string; telephone?: string | null; professionnel: boolean; entreprise: string | null; adresseFacturation: string }
    totaux: { ttc: number }
  }
}

/** Email en minuscules, ou à défaut le téléphone préfixé `tel:`. Une chaîne vide quand on n'a
 *  ni l'un ni l'autre : un contact sans moyen de le joindre n'est pas un client. */
export function cleClient(email?: string | null, telephone?: string | null): string {
  const e = email?.trim().toLowerCase()
  if (e) return e
  const t = (telephone ?? '').replace(/\D/g, '')
  return t ? `tel:${t}` : ''
}

const cleDocument = (d: ClientDocument) =>
  cleClient(d.contenu.client.email, d.contenu.client.telephone)

/** Date qui situe le document dans le temps : son émission, à défaut sa création. */
const dateDocument = (d: ClientDocument) => d.emis_le ?? d.created_at

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
  /** Devis et factures écrits à la main, du plus récent au plus ancien. */
  documents: ClientDocument[]
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
  documents: ClientDocument[] = [],
): ClientProfile | null {
  const key = email.trim().toLowerCase()
  const mine = bookings
    .filter(b => cleClient(b.client_email, b.client_phone) === key)
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())

  const siens = documents
    .filter(d => cleDocument(d) === key)
    .sort((a, b) => new Date(dateDocument(b)).getTime() - new Date(dateDocument(a)).getTime())

  if (mine.length === 0 && siens.length === 0) return null

  // Une facture écrite à la main est un travail fait et payé ; un devis n'est qu'une
  // proposition. Seules les factures comptent donc dans les chiffres du client.
  const facturesFaites = siens.filter(d => d.genre === 'facture')
  const latest = mine[0]
  const honored = mine.filter(isHonored)
  const totalRevenue = honored.reduce((sum, b) => sum + priceOf(b), 0)
    + facturesFaites.reduce((sum, d) => sum + (d.contenu.totaux.ttc ?? 0), 0)

  // Les dates de visite ne comptent que les RDV honorés : un rendez-vous annulé
  // n'est pas une visite, et le faire compter fausserait toute relance.
  const honoredDates = honored.map(b => b.scheduled_at).sort()
  const lastVisit = honoredDates.length ? honoredDates[honoredDates.length - 1] : null

  // Identité : la source la plus récente, réservation ou document. Un client connu par un
  // seul devis n'a pas de réservation d'où tirer son nom.
  const recent = siens[0]
  const identite = latest && (!recent || new Date(latest.scheduled_at) >= new Date(dateDocument(recent)))
    ? {
        email: latest.client_email ?? '',
        name: latest.client_name,
        isProfessional: latest.is_professional,
        companyName: latest.company_name,
      }
    : {
        email: recent.contenu.client.email ?? '',
        name: recent.contenu.client.nom,
        isProfessional: recent.contenu.client.professionnel,
        companyName: recent.contenu.client.entreprise,
      }
  const prestations = honored.length + facturesFaites.length

  return {
    ...identite,
    phone: mine.find(b => b.client_phone)?.client_phone
      ?? siens.find(d => d.contenu.client.telephone)?.contenu.client.telephone
      ?? '',
    addresses: [...new Set([
      ...mine.map(b => b.address),
      ...siens.map(d => d.contenu.client.adresseFacturation),
    ].filter(Boolean))],
    bookings: mine,
    documents: siens,
    totalRevenue,
    honoredCount: prestations,
    cancelledCount: mine.filter(b => b.status === 'cancelled').length,
    averageBasket: prestations ? Math.round(totalRevenue / prestations) : 0,
    firstVisit: honoredDates.length ? honoredDates[0] : null,
    lastVisit,
    daysSinceLastVisit: lastVisit
      ? Math.floor((now.getTime() - new Date(lastVisit).getTime()) / 86_400_000)
      : null,
  }
}

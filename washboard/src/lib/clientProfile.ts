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
//
// Depuis le 2026-09-28 (proposition de Yanis, discutée avec Alexandre), un client peut aussi
// porter des RÉGLAGES écrits à la main — pour l'instant un seul : « ne plus contacter »,
// stocké table `clients` (SQL donné dans la conversation du 2026-09-28). Même principe que les
// documents : un paramètre FACULTATIF (`reglages`), une ligne par client SEULEMENT si quelque
// chose a été réglé — son absence vaut « rien de particulier », le comportement d'aujourd'hui.

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
  /** Facultatifs : absents des listes qui n'en ont pas l'usage (le fichier clients « simple »,
   *  les tests). Nécessaires pour reproduire la décision de relance (`lib/messagesAutomatiques.ts`,
   *  voir `clientsARelancer.ts`) et pour la timeline de la fiche (`clientTimeline.ts`), qui
   *  mélange prestations, avis et relances dans un seul historique. */
  created_at?: string
  followup_sent_at?: string | null
  review_request_sent_at?: string | null
}

/** Un réglage écrit à la main sur un client — table `clients`, SQL donné le 2026-09-28.
 *  Facultatif partout : son absence vaut « rien de particulier ». */
export type ClientReglages = {
  cle: string
  nePlusContacter: boolean
  /** « Supprimer » un client dans la liste (glisser, 2026-09-28) : en réalité un masquage, pas
   *  une vraie suppression — voir `listeClients.ts`, qui l'applique. Un client n'est pas une
   *  ligne qu'on peut effacer, c'est un calcul tiré de ses réservations et de ses documents ;
   *  en supprimer une casserait la numérotation des factures (jamais de trou permis) et la
   *  compta passée. Masquer donne le résultat visible demandé — il disparaît du fichier — sans
   *  toucher à aucune donnée. */
  masque: boolean
  /** Note libre — « portail à code 1234 », « préfère le samedi matin ». */
  notes: string | null
  /** Véhicules du client, en texte libre — « Peugeot 208 grise, plaque AB-123-CD » (2026-09-28,
   *  Alexandre : « comme ça on sait les voitures des gens »). Pas un champ structuré : un
   *  laveur qui lave 2-3 voitures d'un même foyer n'a pas besoin d'un formulaire par véhicule,
   *  une ligne tapée une fois suffit — et il sait déjà écrire une plaque plus vite qu'un champ
   *  ne saurait la valider. */
  vehicules: string | null
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
  /** `null` tant que la facture n'est pas encaissée (`lib/documents.ts`, `estPayee`) — c'est ce
   *  qui décide si elle compte dans les chiffres du client, voir plus bas. Absent sur un devis :
   *  un devis n'est jamais « payé », la question ne se pose pas. */
  paye_le?: string | null
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
  /** Ce qui identifie le client pour le réécrire — voir `ResumeClient.cle`, même règle. */
  cle: string
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
  /** A demandé à ne plus être contacté : les crons de relance et d'avis doivent l'exclure. */
  nePlusContacter: boolean
  /** Écart moyen, en jours, entre deux visites honorées consécutives — « son rythme ».
   *  `null` avec moins de deux visites : une moyenne sur un seul point ne veut rien dire. */
  rythmeJours: number | null
  notes: string | null
  /** Véhicules du client, en texte libre — voir `ClientReglages.vehicules`. */
  vehicules: string | null
}

const isHonored = (b: ClientBooking) => b.status === 'confirmed' || b.status === 'done'
const priceOf = (b: ClientBooking) => b.booked_price ?? b.services?.price ?? 0

export function buildClientProfile(
  bookings: ClientBooking[],
  email: string,
  now: Date = new Date(),
  documents: ClientDocument[] = [],
  reglages: ClientReglages[] = [],
): ClientProfile | null {
  const key = email.trim().toLowerCase()
  const mine = bookings
    .filter(b => cleClient(b.client_email, b.client_phone) === key)
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())

  const siens = documents
    .filter(d => cleDocument(d) === key)
    .sort((a, b) => new Date(dateDocument(b)).getTime() - new Date(dateDocument(a)).getTime())

  if (mine.length === 0 && siens.length === 0) return null

  // Une facture ÉMISE n'est pas de l'argent reçu — elle ne compte dans les chiffres du client
  // qu'une fois ENCAISSÉE (`paye_le` posé, voir `lib/documents.ts`, même règle que l'« Encaissé »
  // de Chiffres, `lib/chiffresArgent.ts`). Avant ce jour-là (2026-09-28), une facture comptait
  // dès sa création, payée ou non — un client dont la facture attendait encore son virement
  // paraissait déjà avoir payé. Un devis, lui, n'est jamais payé : il ne compte jamais.
  const facturesFaites = siens.filter(d => d.genre === 'facture' && !!d.paye_le)
  const latest = mine[0]
  const honored = mine.filter(isHonored)
  const totalRevenue = honored.reduce((sum, b) => sum + priceOf(b), 0)
    + facturesFaites.reduce((sum, d) => sum + (d.contenu.totaux.ttc ?? 0), 0)

  // Les dates de visite ne comptent que les RDV honorés : un rendez-vous annulé
  // n'est pas une visite, et le faire compter fausserait toute relance.
  const honoredDates = honored.map(b => b.scheduled_at).sort()
  const lastVisit = honoredDates.length ? honoredDates[honoredDates.length - 1] : null
  // « Son rythme » : l'écart moyen entre deux visites, pas leur nombre — un client vu deux fois
  // à un mois d'écart n'a pas le même rythme qu'un autre vu deux fois à un an d'écart, même
  // total. Une seule visite ne donne aucun écart à mesurer.
  const rythmeJours = honoredDates.length >= 2
    ? Math.round(
        (new Date(honoredDates[honoredDates.length - 1]).getTime() - new Date(honoredDates[0]).getTime())
        / (honoredDates.length - 1) / 86_400_000,
      )
    : null

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
    cle: key,
    nePlusContacter: reglages.find(r => r.cle === key)?.nePlusContacter ?? false,
    notes: reglages.find(r => r.cle === key)?.notes ?? null,
    vehicules: reglages.find(r => r.cle === key)?.vehicules ?? null,
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
    rythmeJours,
  }
}

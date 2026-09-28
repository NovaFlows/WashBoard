// Fiche entreprise — proposition de Yanis (canevas du 2026-09-28), construite le même jour.
//
// Une entreprise n'a pas sa propre identité dans les réservations : ce qui existe, c'est UN
// CONTACT qui réserve (son email, son téléphone) — Karim, pas « Garage Renault ». Une fiche
// entreprise est donc un REGROUPEMENT de fiches client existantes (`buildClientProfile`),
// jamais une source de données concurrente : les chiffres se recalculent en sommant ceux de
// chaque contact, exactement comme `buildClientProfile` les calcule déjà pour un particulier.
//
// Conséquence assumée, pas un oubli : un contact n'existe ici que s'il a DÉJÀ une fiche client
// (au moins une réservation ou un document). Ajouter quelqu'un qui n'a jamais rien pris — la
// comptable qui ne fait que recevoir les factures, jamais réserver — n'est pas possible
// aujourd'hui : ce serait faire naître un contact sans email ni téléphone d'origine, exactement
// le problème des « prospects », pas encore résolu (voir TODO.md). Rattacher un contact,
// aujourd'hui, veut donc dire choisir un client déjà dans le fichier.

import { buildClientProfile, cleClient, type ClientBooking, type ClientDocument, type ClientProfile, type ClientReglages } from './clientProfile'

export type Entreprise = {
  id: string
  nom: string
  /** Nombre de jours convenus pour le paiement d'une facture. `null` : jamais réglé. */
  delaiPaiementJours: number | null
}

export type Site = {
  id: string
  entrepriseId: string
  adresse: string
  /** Instruction d'accès libre — « Parking arrière, point d'eau à droite ». */
  note: string | null
}

/** Un client (table `clients`) rattaché à une entreprise. */
export type ContactEntreprise = {
  cle: string
  entrepriseId: string
  /** Rôle libre — « Chef d'atelier », « Comptabilité » — et ce qu'il reçoit, en un seul champ :
   *  le canevas de Yanis écrit les deux sur la même ligne (« Chef d'atelier · réserve les
   *  lavages »), rien ne les distingue ailleurs dans le produit. */
  role: string | null
}

export type ContactProfile = ContactEntreprise & {
  /** `null` seulement si la table `clients` porte une clé que plus aucune réservation ni
   *  document ne couvre (un contact rattaché, puis toutes ses réservations supprimées) —
   *  jamais en usage normal. */
  profile: ClientProfile | null
}

/** Une entreprise telle que `clients/page.tsx` la lit : ses sites et ses contacts déjà joints,
 *  sans agrégation — `buildEntrepriseProfile` s'en charge dans le navigateur. */
export type EntrepriseListItem = Entreprise & { sites: Site[]; contacts: ContactEntreprise[] }

export type EntrepriseProfile = {
  entreprise: Entreprise
  sites: Site[]
  contacts: ContactProfile[]
  /** Somme des factures ENCAISSÉES des contacts — jamais une facture juste émise (voir
   *  `ClientProfile.totalRevenue`, même règle que l'« Encaissé » de Chiffres). */
  totalRevenue: number
  /** « Véhicules » du canevas : le nombre de prestations honorées, tous contacts confondus —
   *  même mot que `ClientProfile.honoredCount`, au pluriel de l'entreprise. */
  vehicules: number
  /** Réservations de tous les contacts, la plus récente en premier. */
  derniersPassages: ClientBooking[]
  /** Devis envoyés à un contact de l'entreprise, sans réponse — pas encore de notion de
   *  « retard » (aucun seuil réglé nulle part, voir TODO.md « Relancer les devis sans réponse »),
   *  seulement le fait et depuis combien de temps. */
  devisEnAttente: { document: ClientDocument; jours: number }[]
  /** Factures émises à un contact de l'entreprise, pas encore encaissées — même logique que
   *  `devisEnAttente`, sur l'autre automatisme : « depuis combien de temps », jamais « en
   *  retard » (aucun délai de relance de facture réglé nulle part). */
  facturesImpayees: { document: ClientDocument; jours: number }[]
}

export function buildEntrepriseProfile(
  entreprise: Entreprise,
  sites: Site[],
  contactsBruts: ContactEntreprise[],
  bookings: ClientBooking[],
  documents: ClientDocument[],
  now: Date = new Date(),
  reglages: ClientReglages[] = [],
): EntrepriseProfile {
  const contacts: ContactProfile[] = contactsBruts.map(c => ({
    ...c,
    profile: buildClientProfile(bookings, c.cle, now, documents, reglages),
  }))

  const totalRevenue = contacts.reduce((s, c) => s + (c.profile?.totalRevenue ?? 0), 0)
  const vehicules = contacts.reduce((s, c) => s + (c.profile?.honoredCount ?? 0), 0)

  const derniersPassages = contacts
    .flatMap(c => c.profile?.bookings ?? [])
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())

  const clesContacts = new Set(contactsBruts.map(c => c.cle))
  const enAttenteDepuis = (d: ClientDocument) =>
    Math.floor((now.getTime() - new Date(d.emis_le ?? d.created_at).getTime()) / 86_400_000)
  const documentsDesContacts = documents.filter(d =>
    clesContacts.has(cleClient(d.contenu.client.email, d.contenu.client.telephone)))

  const devisEnAttente = documentsDesContacts
    .filter(d => d.genre === 'devis' && d.statut === 'envoye')
    .map(d => ({ document: d, jours: enAttenteDepuis(d) }))
    .sort((a, b) => b.jours - a.jours)

  const facturesImpayees = documentsDesContacts
    .filter(d => d.genre === 'facture' && !d.paye_le)
    .map(d => ({ document: d, jours: enAttenteDepuis(d) }))
    .sort((a, b) => b.jours - a.jours)

  return { entreprise, sites, contacts, totalRevenue, vehicules, derniersPassages, devisEnAttente, facturesImpayees }
}

// Jeu de données fabriqué EN MÉMOIRE pour `/demo` — jamais une ligne écrite en base.
//
// Pourquoi ce fichier existe : le tableau de bord réel d'Alexandre est pauvre en données, donc
// les écrans de la refonte (ClientsViewV2 en particulier) ont l'air vides sur ses propres
// captures. Demander d'y « rajouter des clients pour les tests » reviendrait à écrire dans la
// vraie base de production (ce dépôt n'a pas de base de test séparée, voir `e2e/helpers.ts`) —
// de vrais inserts compteraient dans son chiffre d'affaires et son quota, et les automatismes
// (demande d'avis, relance) enverraient de vrais messages à des numéros inventés. Interdit.
//
// À la place : un jeu de données qui respecte EXACTEMENT les types réels (`ClientBooking`,
// `ClientDocument`, `ClientReglages`, `EntrepriseListItem`, `AutomatismesClients`) — c'est
// `tsc` qui valide la forme, pas une relecture à l'œil — et que `/demo` passe aux VRAIS
// composants (`ClientsViewV2`). Aucune requête Supabase ici, aucun appel réseau : du calcul pur,
// comme `clientProfile.ts` dont il respecte les règles (regroupement par email, un devis ne
// compte jamais, une facture seulement si encaissée...).
//
// Conventions reprises de `washboard-design/maquettes/bureau-2026/README.md` : Julien Roussel,
// enseigne « Éclat Mobile », Bordeaux, offre Pro. Les rendez-vous de la semaine sont calculés à
// partir d'AUJOURD'HUI (jamais de date figée) : ce fichier reste correct quel que soit le jour
// où `/demo` est ouvert.

import type { Booking, Category, ServiceFull, Unavailability } from '@/components/dashboard/CalendrierDashboardV1'
import type { ClientBooking, ClientDocument, ClientReglages } from '@/lib/clientProfile'
import type { ReglagesRelance } from '@/lib/clientsARelancer'
import type { EntrepriseListItem } from '@/lib/entrepriseProfile'
import type { AutomatismesClients } from '@/components/dashboard/AutomatismesClientsV2'
import type { RdvAccueil } from '@/components/dashboard/AccueilV2'
import type { ReservationMasquee } from '@/components/dashboard/ReservationVerrouilleeV2'
import type { MessagesAutomatiquesProps } from '@/components/dashboard/MessagesAutomatiquesV2'
import type { RdvMessage } from '@/lib/messagesAutomatiques'
import type { ChiffresEvent } from '@/components/dashboard/ChiffresV2'
import type { FactureManuelle } from '@/lib/chiffresArgent'
import type { Device } from '@/lib/funnelTracking'
import type { Depense, DepenseRecurrente } from '@/lib/depenses'
import { bilanCampagne, resteHorsCreations, type BilanCreation, type CampagneAffichee, type Creation } from '@/lib/campagne'
import type { WidgetKey } from '@/lib/dashboardWidgets'
import type { Availability, Service, ServiceCategory, Unavailability as UnavailabilityReelle, Washer, ZoneConfig } from '@/types'
import { quotaReservations, quotaPrestations, libelleRemiseAZero, type Plan } from '@/lib/plan'
import type { ReglagesApparence } from '@/hooks/useApparenceV2'
import type { ReglagesListeProps } from '@/components/dashboard/ListeReglagesV2'
import type { PropsAbonnement } from '@/components/dashboard/Abonnement'
import type { SupportThread } from '@/lib/support'
import { computeSetupProgress, type SetupProgress, etapeDemarrage } from '@/lib/setupProgress'
import { semaineAccueil, type JourSemaine, type RdvPourSemaine } from '@/lib/semaineAccueil'
import { totalLignes, type Document, type GenreDocument, type StatutDocument } from '@/lib/documents'
import { totauxFacture, type LigneFacture } from '@/lib/facture'

// ── Prestations et prix (cohérents avec la grille réelle d'Éclat Mobile) ───────────────────
const SERVICE_EXPRESS = { name: 'Extérieur express', price: 35, duration_minutes: 25 }
const SERVICE_COMPLET = { name: 'Extérieur + intérieur', price: 59, duration_minutes: 50 }
const SERVICE_SIEGES = { name: 'Rénovation sièges', price: 120, duration_minutes: 90 }
// Forfait flotte : 70 €/véhicule. La ligne « Flotte Déplacement Bordeaux » ci-dessous porte 3
// véhicules — prix affiché déjà multiplié (210 €), comme le ferait une vraie réservation.
const SERVICE_FLOTTE_3_VEHICULES = { name: 'Forfait flotte', price: 210, duration_minutes: 90 }

// ── Dates : toujours calculées depuis « maintenant », jamais écrites en dur ────────────────

/** Jour, à l'heure donnée, à N jours d'aujourd'hui (N négatif = dans le passé). */
function versISO(offsetJours: number, heure: number, minute = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetJours)
  d.setHours(heure, minute, 0, 0)
  return d.toISOString()
}

/** Un rendez-vous À VENIR, toujours dans la semaine en cours : borné au nombre de jours qui
 *  restent avant dimanche, pour ne jamais déborder sur la semaine suivante. */
function aVenirCetteSemaine(offsetSouhaite: number, heure: number, minute = 0): string {
  const aujourdhui = new Date()
  const jourSemaine = (aujourdhui.getDay() + 6) % 7 // 0 = lundi … 6 = dimanche
  const joursRestants = 6 - jourSemaine
  return versISO(Math.max(0, Math.min(joursRestants, offsetSouhaite)), heure, minute)
}

/** Un rendez-vous PASSÉ, toujours strictement avant aujourd'hui. */
function ilYA(jours: number, heure = 10, minute = 0): string {
  return versISO(-Math.max(1, jours), heure, minute)
}

/** YYYY-MM-DD, pour les champs qui n'attendent qu'un jour civil (campagnes publicitaires). */
function jourCivilILYA(jours: number): string {
  const d = new Date()
  d.setDate(d.getDate() - jours)
  return d.toLocaleDateString('en-CA')
}

// ── Les 20 clients d'Éclat Mobile ──────────────────────────────────────────────────────────
//
// 4 professionnels (Karim, Sophie, Pierre, David), dont deux — Karim et Sophie — sont les
// contacts d'une même entreprise à deux sites (« Flotte Déplacement Bordeaux », voir plus bas).
// 8 clients portent un rendez-vous DANS LA SEMAINE EN COURS, aux quatre états demandés
// (confirmé, en attente, terminé, annulé). Les autres n'ont qu'un historique, dont trois assez
// anciens pour alimenter l'onglet « À relancer ». Les deux derniers (Maxime, Chloé) ne sont nés
// que d'un devis ou d'une facture — jamais d'une réservation — pour exercer ce cas réel du
// produit (voir `clientProfile.ts`).

export function jeuDeDonneesDemo(): {
  bookings: ClientBooking[]
  documents: ClientDocument[]
  reglages: ClientReglages[]
  reglagesMessages: ReglagesRelance
  entreprises: EntrepriseListItem[]
  nomLaveur: string
  automatismes: AutomatismesClients
  /** Réservations venues au-delà du quota de l'offre — écran 66 de la maquette bureau
   *  (« Réservation verrouillée »). Même forme que `ReservationMasquee` (nom, téléphone, email,
   *  adresse et heure jamais chargés, voir `ReservationVerrouilleeV2.tsx`) : passées à
   *  `ClientsViewV2` sous `bloques`, en tête de la liste « Tous ». */
  bloques: ReservationMasquee[]
  offreDeblocage: string
} {
  const bookings: ClientBooking[] = [
    // — Cette semaine —
    {
      id: 'demo-rdv-karim-flotte',
      client_name: 'Karim Benali', client_email: 'karim.benali@flotte-bordeaux.fr', client_phone: '0610000001',
      address: '12 Rue du Hangar, 33300 Bordeaux',
      scheduled_at: aVenirCetteSemaine(2, 9, 0),
      status: 'confirmed', closed_late: false, booked_price: 210,
      is_professional: true, company_name: 'Flotte Déplacement Bordeaux',
      services: SERVICE_FLOTTE_3_VEHICULES,
    },
    {
      id: 'demo-rdv-claire-1',
      client_name: 'Claire Dubois', client_email: 'claire.dubois@gmail.com', client_phone: '0612345678',
      address: '3 Rue Sainte-Catherine, 33000 Bordeaux',
      scheduled_at: aVenirCetteSemaine(0, 10, 0),
      status: 'confirmed', closed_late: false, booked_price: 35,
      is_professional: false, company_name: null,
      services: SERVICE_EXPRESS,
      vehicles_detail: [{ models: ['Peugeot 208'] }],
    },
    {
      id: 'demo-rdv-marc',
      client_name: 'Marc Lefevre', client_email: 'marc.lefevre@orange.fr', client_phone: '0623456789',
      address: '15 Rue Judaïque, 33000 Bordeaux',
      scheduled_at: aVenirCetteSemaine(3, 9, 30),
      status: 'pending', closed_late: false, booked_price: 35,
      is_professional: false, company_name: null,
      services: SERVICE_EXPRESS,
    },
    {
      id: 'demo-rdv-david',
      client_name: 'David Rousseau', client_email: 'david.rousseau@rousseau-immo.fr', client_phone: '0699998888',
      address: '20 Cours de l’Intendance, 33000 Bordeaux',
      scheduled_at: aVenirCetteSemaine(4, 11, 0),
      status: 'pending', closed_late: false, booked_price: 59,
      is_professional: true, company_name: 'Rousseau Immobilier',
      services: SERVICE_COMPLET,
    },
    {
      id: 'demo-rdv-pierre',
      client_name: 'Pierre Moreau', client_email: 'pierre.moreau@moreauautodetail.fr', client_phone: '0611112222',
      address: '5 Rue des Artisans, 33000 Bordeaux',
      scheduled_at: aVenirCetteSemaine(1, 14, 0),
      status: 'confirmed', closed_late: false, booked_price: 120,
      is_professional: true, company_name: 'Moreau Auto Détailing',
      services: SERVICE_SIEGES,
      vehicles_detail: [{ models: ['Porsche Cayenne'] }],
    },
    {
      id: 'demo-rdv-julien',
      client_name: 'Julien Petit', client_email: 'julien.petit@free.fr', client_phone: '0634567890',
      address: '27 Rue du Palais Gallien, 33000 Bordeaux',
      scheduled_at: ilYA(2, 8, 0),
      status: 'done', closed_late: false, booked_price: 59,
      is_professional: false, company_name: null,
      services: SERVICE_COMPLET,
    },
    {
      id: 'demo-rdv-nathalie',
      client_name: 'Nathalie Robert', client_email: 'nathalie.robert@yahoo.fr', client_phone: '0645678901',
      address: '9 Rue Fondaudège, 33000 Bordeaux',
      scheduled_at: ilYA(1, 15, 0),
      status: 'cancelled', closed_late: false, booked_price: 35,
      is_professional: false, company_name: null,
      services: SERVICE_EXPRESS,
    },
    {
      id: 'demo-rdv-emilie',
      client_name: 'Émilie Bertrand', client_email: 'emilie.bertrand@gmail.com', client_phone: '0656789012',
      address: '41 Rue Notre-Dame, 33000 Bordeaux',
      scheduled_at: ilYA(3, 9, 0),
      status: 'done', closed_late: false, booked_price: 35,
      is_professional: false, company_name: null,
      services: SERVICE_EXPRESS,
    },

    // — Historique seul (pas de rendez-vous cette semaine) —
    {
      id: 'demo-rdv-sophie-ancien',
      client_name: 'Sophie Marchand', client_email: 'sophie.marchand@flotte-bordeaux.fr', client_phone: '0610000002',
      address: '8 Avenue des Transports, 33700 Mérignac',
      scheduled_at: ilYA(45, 10, 0),
      status: 'done', closed_late: false, booked_price: 35,
      is_professional: true, company_name: 'Flotte Déplacement Bordeaux',
      services: SERVICE_EXPRESS,
    },
    {
      id: 'demo-rdv-nicolas',
      client_name: 'Nicolas Faure', client_email: 'nicolas.faure@gmail.com', client_phone: '0667890123',
      address: '2 Rue de la Devise, 33000 Bordeaux',
      scheduled_at: ilYA(20, 11, 0),
      status: 'done', closed_late: false, booked_price: 59,
      is_professional: false, company_name: null,
      services: SERVICE_COMPLET,
    },
    {
      id: 'demo-rdv-laura',
      client_name: 'Laura Simon', client_email: 'laura.simon@hotmail.fr', client_phone: '0678901234',
      address: '18 Rue du Loup, 33000 Bordeaux',
      scheduled_at: ilYA(35, 14, 0),
      status: 'done', closed_late: false, booked_price: 35,
      is_professional: false, company_name: null,
      services: SERVICE_EXPRESS,
    },
    {
      id: 'demo-rdv-antoine',
      client_name: 'Antoine Michel', client_email: 'antoine.michel@gmail.com', client_phone: '0689012345',
      address: '30 Rue Sainte-Croix, 33000 Bordeaux',
      scheduled_at: ilYA(60, 9, 30),
      status: 'done', closed_late: false, booked_price: 59,
      is_professional: false, company_name: null,
      services: SERVICE_COMPLET,
    },
    {
      id: 'demo-rdv-camille',
      client_name: 'Camille Lambert', client_email: 'camille.lambert@gmail.com', client_phone: '0690123456',
      address: '14 Rue Lecocq, 33000 Bordeaux',
      scheduled_at: ilYA(10, 10, 30),
      status: 'done', closed_late: false, booked_price: 120,
      is_professional: false, company_name: null,
      services: SERVICE_SIEGES,
    },
    {
      id: 'demo-rdv-sarah',
      client_name: 'Sarah Blanchard', client_email: 'sarah.blanchard@gmail.com', client_phone: '0601234567',
      address: '22 Rue du Mirail, 33000 Bordeaux',
      scheduled_at: ilYA(5, 9, 0),
      status: 'done', closed_late: false, booked_price: 35,
      is_professional: false, company_name: null,
      services: SERVICE_EXPRESS,
    },
    {
      id: 'demo-rdv-lea',
      client_name: 'Léa Mercier', client_email: 'lea.mercier@gmail.com', client_phone: '0612309876',
      address: '6 Rue des Trois Conils, 33000 Bordeaux',
      scheduled_at: ilYA(15, 16, 0),
      status: 'done', closed_late: false, booked_price: 59,
      is_professional: false, company_name: null,
      services: SERVICE_COMPLET,
    },

    // — À relancer (dernier passage ancien, pas de nouveau rendez-vous) —
    {
      id: 'demo-rdv-thomas',
      client_name: 'Thomas Girard', client_email: 'thomas.girard@gmail.com', client_phone: '0623987654',
      address: '11 Rue du Hâ, 33000 Bordeaux',
      scheduled_at: ilYA(130, 10, 0),
      status: 'confirmed', closed_late: false, booked_price: 59,
      is_professional: false, company_name: null,
      services: SERVICE_COMPLET,
      followup_sent_at: null,
    },
    {
      id: 'demo-rdv-isabelle',
      client_name: 'Isabelle Fontaine', client_email: 'isabelle.fontaine@gmail.com', client_phone: '0634561234',
      address: '25 Cours Victor Hugo, 33000 Bordeaux',
      scheduled_at: ilYA(200, 9, 0),
      status: 'done', closed_late: false, booked_price: 35,
      is_professional: false, company_name: null,
      services: SERVICE_EXPRESS,
      // Relance déjà partie il y a 15 jours : statut « Relancé il y a 15 j ».
      followup_sent_at: ilYA(15, 8, 0),
    },
    {
      id: 'demo-rdv-hugo',
      client_name: 'Hugo Garnier', client_email: 'hugo.garnier@gmail.com', client_phone: '0645123789',
      address: '33 Rue Saint-James, 33000 Bordeaux',
      scheduled_at: ilYA(95, 11, 0),
      status: 'confirmed', closed_late: false, booked_price: 59,
      is_professional: false, company_name: null,
      services: SERVICE_COMPLET,
      followup_sent_at: null,
    },
  ]

  // Deux clients nés d'un document écrit à la main, jamais d'une réservation — cas réel du
  // produit depuis le 2026-09-27 (« un client comme un autre », voir `clientProfile.ts`).
  const documents: ClientDocument[] = [
    {
      id: 'demo-doc-d41', genre: 'devis', numero: 'D-00041', statut: 'envoye',
      emis_le: ilYA(4, 9, 0), created_at: ilYA(4, 9, 0),
      contenu: {
        client: {
          nom: 'Thomas Girard', email: 'thomas.girard@gmail.com', telephone: '0623987654',
          professionnel: false, entreprise: null, adresseFacturation: '11 Rue du Hâ, 33000 Bordeaux',
          vehicule: 'Renault Clio',
        },
        totaux: { ttc: 120 },
      },
    },
    {
      // Maxime Dupuis n'existe dans le fichier clients QUE par ce devis : aucune réservation.
      id: 'demo-doc-d43', genre: 'devis', numero: 'D-00043', statut: 'envoye',
      emis_le: ilYA(6, 14, 0), created_at: ilYA(6, 14, 0),
      contenu: {
        client: {
          nom: 'Maxime Dupuis', email: 'maxime.dupuis@gmail.com', telephone: '0656123498',
          professionnel: false, entreprise: null, adresseFacturation: '17 Rue Boudet, 33000 Bordeaux',
          vehicule: 'Citroën C4',
        },
        totaux: { ttc: 59 },
      },
    },
    {
      // Chloé Lefebvre n'existe dans le fichier clients QUE par cette facture encaissée.
      id: 'demo-doc-f37', genre: 'facture', numero: 'F-00037', statut: 'emis',
      emis_le: ilYA(22, 10, 0), created_at: ilYA(22, 10, 0), paye_le: ilYA(18, 9, 0),
      contenu: {
        client: {
          nom: 'Chloé Lefebvre', email: 'chloe.lefebvre@gmail.com', telephone: '0667891234',
          professionnel: false, entreprise: null, adresseFacturation: '4 Rue des Faussets, 33000 Bordeaux',
          vehicule: 'Fiat 500',
        },
        totaux: { ttc: 59 },
      },
    },
    {
      id: 'demo-doc-f38', genre: 'facture', numero: 'F-00038', statut: 'emis',
      emis_le: ilYA(40, 10, 0), created_at: ilYA(40, 10, 0), paye_le: ilYA(33, 9, 0),
      contenu: {
        client: {
          nom: 'Sophie Marchand', email: 'sophie.marchand@flotte-bordeaux.fr', telephone: '0610000002',
          professionnel: true, entreprise: 'Flotte Déplacement Bordeaux',
          adresseFacturation: '8 Avenue des Transports, 33700 Mérignac',
        },
        totaux: { ttc: 35 },
      },
    },
    {
      id: 'demo-doc-f39', genre: 'facture', numero: 'F-00039', statut: 'emis',
      emis_le: ilYA(60, 10, 0), created_at: ilYA(60, 10, 0), paye_le: ilYA(52, 9, 0),
      contenu: {
        client: {
          nom: 'Karim Benali', email: 'karim.benali@flotte-bordeaux.fr', telephone: '0610000001',
          professionnel: true, entreprise: 'Flotte Déplacement Bordeaux',
          adresseFacturation: '12 Rue du Hangar, 33300 Bordeaux',
        },
        totaux: { ttc: 210 },
      },
    },
  ]

  // Réglages écrits à la main : une note, un véhicule noté — pour que la fiche ne soit jamais
  // complètement vide sur ces deux-là. Tous les autres clients valent « rien de particulier ».
  const reglages: ClientReglages[] = [
    {
      cle: 'claire.dubois@gmail.com', nePlusContacter: false, masque: false,
      notes: 'Portail arrière, code 2580.', vehicules: null, nom: null, telephone: null,
    },
    {
      cle: 'pierre.moreau@moreauautodetail.fr', nePlusContacter: false, masque: false,
      notes: null, vehicules: 'Porsche Cayenne noire, plaque PM-120-ZT', nom: null, telephone: null,
    },
  ]

  const reglagesMessages: ReglagesRelance = {
    followup_enabled: true,
    followup_delay_days: 90,
    followup_message: 'Bonjour {{nom}}, ça fait un moment qu’on ne vous a pas vu — on vous remet un créneau ?',
  }

  // Flotte Déplacement Bordeaux : l'entreprise à plusieurs sites, deux contacts déjà dans la
  // liste ci-dessus (Karim et Sophie).
  const entreprises: EntrepriseListItem[] = [
    {
      id: 'demo-entreprise-flotte',
      nom: 'Flotte Déplacement Bordeaux',
      delaiPaiementJours: 30,
      sites: [
        { id: 'demo-site-1', entrepriseId: 'demo-entreprise-flotte', adresse: '12 Rue du Hangar, 33300 Bordeaux', note: 'Portail à code, cour à l’arrière' },
        { id: 'demo-site-2', entrepriseId: 'demo-entreprise-flotte', adresse: '8 Avenue des Transports, 33700 Mérignac', note: null },
      ],
      contacts: [
        { cle: 'karim.benali@flotte-bordeaux.fr', entrepriseId: 'demo-entreprise-flotte', role: 'Chef d’atelier · réserve les lavages' },
        { cle: 'sophie.marchand@flotte-bordeaux.fr', entrepriseId: 'demo-entreprise-flotte', role: 'Comptabilité · reçoit les factures' },
      ],
    },
  ]

  const automatismes: AutomatismesClients = {
    messages: {
      review_enabled: true,
      review_delay_hours: 3,
      google_review_url: 'https://g.page/r/exemple-eclat-mobile/review',
      review_channel: 'sms',
      followup_enabled: true,
      followup_delay_days: 90,
      followup_message: reglagesMessages.followup_message,
    },
    // Deux campagnes, une en cours — mêmes dates que `jeuDeDonneesPublicitesDemo()` plus bas
    // (écrans 33/34) : cette ligne-résumé et l'écran détaillé doivent raconter la même chose.
    campagnes: [
      { debut: jourCivilILYA(40), fin: null, budget_maj_le: ilYA(22, 9, 0) },
      { debut: jourCivilILYA(60), fin: jourCivilILYA(45), budget_maj_le: jourCivilILYA(45) },
    ],
    publicitesAutorisees: true,
    libellePlanPublicites: 'Pro',
    smsAutorise: true,
    avisAutorise: true,
    relanceAutorisee: true,
    libellePlanAvis: 'Pro',
    libellePlanRelance: 'Pro',
    creneaux: { actif: true, proximite: 15, type: 'percent', valeur: 10 },
    prestationsPrix: [
      { nom: SERVICE_EXPRESS.name, prix: SERVICE_EXPRESS.price },
      { nom: SERVICE_COMPLET.name, prix: SERVICE_COMPLET.price },
      { nom: SERVICE_SIEGES.name, prix: SERVICE_SIEGES.price },
      { nom: 'Forfait flotte', prix: 70 },
    ],
  }

  // Trois réservations qui existent (un vrai client a réservé) mais que l'offre Starter ne
  // montre pas — même convention que `jeuDeDonneesAccueilDemo()` (état « Quota atteint »,
  // plus bas) pour les mêmes trois jours récents.
  const bloques: ReservationMasquee[] = [
    { id: 'demo-bloque-1', scheduled_at: ilYA(1, 9, 0) },
    { id: 'demo-bloque-2', scheduled_at: ilYA(2, 14, 30) },
    { id: 'demo-bloque-3', scheduled_at: ilYA(3, 11, 0) },
  ]

  return {
    bookings, documents, reglages, reglagesMessages, entreprises, nomLaveur: 'Julien Roussel', automatismes,
    bloques, offreDeblocage: 'Starter',
  }
}

// ── Jeu de données pour « Aujourd'hui » (AccueilV2), passe bureau ─────────────────────────────
//
// Les trois états dessinés par `washboard-design/maquettes/bureau-2026/index.html` pour cet
// écran (1, 45, 46 — le 4e, la fiche d'un client verrouillé, écran 48, n'a besoin d'aucune donnée
// de plus : c'est l'interaction déjà câblée dans `LigneRdvVerrouilleeV2`, qui s'ouvre d'elle-même
// au clic sur une ligne de `verrouillees` ci-dessous). Même convention que `jeuDeDonneesDemo` :
// aucune date figée, tout calculé depuis « maintenant ».
//
// Les écrans 45 et 46 reprennent, comme la maquette elle-même, l'offre Starter (quota 15) plutôt
// que le Pro d'Éclat Mobile : c'est le seul cas réel où `JaugeReservationsV2` a quelque chose à
// montrer (le Pro n'a pas de plafond, voir `lib/plan.ts`, `BOOKING_QUOTA`).

export type EtatAccueilDemo = 'normal' | 'premier-jour' | 'quota'

function aujourdhuiA(heure: number, minute = 0): string {
  const d = new Date()
  d.setHours(heure, minute, 0, 0)
  return d.toISOString()
}

function dansNJours(jours: number, heure: number, minute = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + jours)
  d.setHours(heure, minute, 0, 0)
  return d.toISOString()
}

/** `AAAA-MM-JJ`, à N jours d'aujourd'hui — même décalage que `dansNJours`, mais pour un champ
 *  qui n'attend qu'un jour civil (`demainStr`, voir `AccueilDemo`). */
function jourCivilDansNJours(jours: number): string {
  const d = new Date()
  d.setDate(d.getDate() + jours)
  return d.toLocaleDateString('en-CA')
}

/** Un rendez-vous À VENIR, borné à la semaine en cours — même idée que `aVenirCetteSemaine`
 *  plus haut (réservé aux rendez-vous AFFICHÉS, celle-ci porte les mêmes bornes pour le simple
 *  comptage de « Cette semaine », qui n'a besoin que du statut et de l'heure). */
function versISOCetteSemaine(offsetSouhaite: number, heure: number, minute = 0): string {
  const aujourdhui = new Date()
  const jourSemaine = (aujourdhui.getDay() + 6) % 7 // 0 = lundi … 6 = dimanche
  const joursRestants = 6 - jourSemaine
  return versISO(Math.max(0, Math.min(joursRestants, offsetSouhaite)), heure, minute)
}

const ZONE_GIRONDE: ZoneConfig = { enabled: true, type: 'departments', departments: ['33'] }

export type AccueilDemo = {
  rdvAujourdhui: RdvAccueil[]
  rdvProchains: RdvAccueil[]
  aConfirmer: RdvAccueil[]
  verrouillees: ReservationMasquee[]
  journeeCommencee: boolean
  dateDuJour: string
  widgets: WidgetKey[]
  stats: { terminesCeMois: number; caCeMois: number | null } | null
  clients: { total: number; nouveauxCetteSemaine: number } | null
  trafic: { visiteurs: number; conversions: number } | null
  prestationTop: { nom: string; nombre: number } | null
  zone: ZoneConfig
  jauge: { utilisees: number; quota: number | null; offre: Plan; remiseAZero?: string }
  offreDeblocage: string
  /** « Cette semaine » (colonne de droite, bureau) — sept jours construits par la VRAIE fonction
   *  pure du produit (`semaineAccueil`, voir `lib/semaineAccueil.ts`), jamais une liste de points
   *  inventée à la main : cette page sert aussi à prouver que la fonction testée produit un
   *  résultat crédible sur un jeu de données plausible. */
  semaine: JourSemaine[]
  /** « Demain » (même colonne, juste au-dessus) — un sous-ensemble de `rdvProchains` (même
   *  rendez-vous, voir plus bas), jamais une seconde liste fabriquée à côté. */
  rdvDemain: RdvAccueil[]
  /** Demain, `AAAA-MM-JJ` — pour l'intitulé de la section. */
  demainStr: string
  /** Pour construire `<DemarrageCard progress={progress} />` : la vraie fonction du produit,
   *  jamais une progression inventée (voir `configurationIncomplete` ci-dessous, qui lit le même
   *  objet — exactement la paire que reçoit `AccueilV2` depuis `dashboard/page.tsx`). */
  progress: SetupProgress
  configurationIncomplete: boolean
}

/** Widgets par défaut, dans l'ordre de `WIDGETS` (voir `dashboardWidgets.ts`) — un compte qui n'a
 *  jamais touché au réglage les voit tous, `today` mis à part (pas lu par `AccueilV2`). */
const WIDGETS_DEMO: WidgetKey[] = ['stats', 'clients', 'upcoming', 'traffic', 'services', 'zone']

export function jeuDeDonneesAccueilDemo(etat: EtatAccueilDemo): AccueilDemo {
  const dateDuJour = new Date().toLocaleDateString('en-CA')

  if (etat === 'premier-jour') {
    // Écran 45 : un compte qui vient de s'inscrire, rien n'est encore configuré — exactement ce
    // que `computeSetupProgress` calcule pour une fiche laveur toute neuve.
    const progress = computeSetupProgress({
      servicesCount: 0, availabilitiesCount: 0, baseAddress: null, phone: null, logoUrl: null,
      googleCalendarConnected: false, reviewsEnabled: false, followupEnabled: false,
      zoneEnabled: false, smartSlotEnabled: false, welcomeMessage: null,
    })
    return {
      rdvAujourdhui: [], rdvProchains: [], aConfirmer: [], verrouillees: [],
      journeeCommencee: false, dateDuJour, widgets: WIDGETS_DEMO,
      stats: null, clients: null, trafic: null, prestationTop: null,
      zone: { enabled: false },
      jauge: { utilisees: 0, quota: 15, offre: 'starter' },
      offreDeblocage: 'Pro',
      // Un compte tout neuf n'a encore RIEN — ni rendez-vous, ni horaires réglés : `joursOuverts`
      // à `null` (information jamais lue, voir `semaineAccueil.ts`) plutôt qu'un ensemble vide,
      // qui aurait affiché sept jours « fermés » au lieu de sept jours simplement calmes.
      semaine: semaineAccueil([], dateDuJour, null),
      rdvDemain: [],
      demainStr: jourCivilDansNJours(1),
      progress,
      configurationIncomplete: etapeDemarrage(progress) !== null,
    }
  }

  // — La journée du jour, commune aux écrans « normal » (1) et « quota atteint » (46) : la
  // maquette bureau réutilise elle-même les trois mêmes rendez-vous pour les deux écrans. —
  const camille: RdvAccueil = {
    id: 'demo-accueil-camille', client_name: 'Camille Lefebvre', client_phone: '0610203040',
    address: '12 Rue Fondaudège, Bordeaux', lat: 44.846, lng: -0.586,
    scheduled_at: aujourdhuiA(14, 30), status: 'confirmed', is_smart_slot: false, smart_discount: 0,
    booked_price: 59, services: { name: 'Extérieur + intérieur', price: 59, duration_minutes: 50 },
  }
  const marc: RdvAccueil = {
    id: 'demo-accueil-marc', client_name: 'Marc Dubreuil', client_phone: '0620304050',
    address: '8 Cours de la Marne, Bordeaux', lat: 44.834, lng: -0.561,
    scheduled_at: aujourdhuiA(16, 0), status: 'confirmed', is_smart_slot: false, smart_discount: 0,
    booked_price: 35, services: { name: 'Extérieur express', price: 35, duration_minutes: 25 },
  }
  const garage: RdvAccueil = {
    id: 'demo-accueil-garage', client_name: 'Garage Renault Mérignac', client_phone: '0556001122',
    address: '2 Avenue de Mérignac, Mérignac', lat: 44.839, lng: -0.651,
    scheduled_at: aujourdhuiA(17, 30), status: 'pending', is_smart_slot: false, smart_discount: 0,
    booked_price: 210, services: { name: 'Forfait flotte · 3 véhicules', price: 210, duration_minutes: 90 },
  }
  // Demain — nourrit à la fois « À confirmer » (Sophie, en attente) et la section « Ensuite » des
  // widgets de droite (Thomas ET Sophie) : même donnée, deux lectures, comme le fait réellement
  // `AccueilV2` (voir son en-tête) — pas une coïncidence de ce jeu de données.
  const thomas: RdvAccueil = {
    id: 'demo-accueil-thomas', client_name: 'Thomas Girard', client_phone: '0623987654',
    address: '11 Rue du Hâ, Bordeaux', lat: 44.838, lng: -0.574,
    scheduled_at: dansNJours(1, 9, 0), status: 'confirmed', is_smart_slot: false, smart_discount: 0,
    booked_price: 120, services: { name: 'Rénovation sièges', price: 120, duration_minutes: 90 },
  }
  const sophie: RdvAccueil = {
    id: 'demo-accueil-sophie', client_name: 'Sophie Lambert', client_phone: '0634567890',
    address: '5 Rue Judaïque, Bordeaux', lat: 44.841, lng: -0.588,
    scheduled_at: dansNJours(1, 10, 0), status: 'pending', is_smart_slot: false, smart_discount: 0,
    booked_price: 35, services: { name: 'Extérieur express', price: 35, duration_minutes: 25 },
  }

  // « Cette semaine » (colonne de droite, bureau) : une semaine crédible — au moins un jour avec
  // un rendez-vous confirmé, un jour avec une demande en attente, et des jours vides, construite
  // à partir des MÊMES rendez-vous que le reste de l'écran plutôt que d'une liste séparée (aucun
  // nom requis : `semaineAccueil` ne lit que l'heure et le statut).
  //
  // - Aujourd'hui et demain ont déjà camille/marc/garage et thomas/sophie : chacun des deux jours
  //   porte une demande en attente (garage, sophie), donc l'« attente » y prime sur le confirmé —
  //   exactement la règle de `semaineAccueil`.
  // - Un jour confirmé SANS attente, pour montrer les trois états à la fois (le troisième, vide,
  //   n'a besoin d'aucune entrée : les jours sans rien dedans le sont déjà).
  const semaineBookings: RdvPourSemaine[] = [
    { scheduled_at: aujourdhuiA(14, 30), status: 'confirmed' },
    { scheduled_at: aujourdhuiA(17, 30), status: 'pending' },
    { scheduled_at: dansNJours(1, 9, 0), status: 'confirmed' },
    { scheduled_at: dansNJours(1, 10, 0), status: 'pending' },
    { scheduled_at: versISOCetteSemaine(2, 15, 0), status: 'confirmed' },
  ]
  // Fermé le dimanche (0) — plausible pour un laveur mobile, et ça donne à l'écran un jour qui se
  // distingue d'un jour simplement calme (voir `semaineAccueil.ts`, état `ferme`).
  const joursOuvertsDemo = new Set([1, 2, 3, 4, 5, 6])
  const semaine = semaineAccueil(semaineBookings, dateDuJour, joursOuvertsDemo)
  const demainStr = jourCivilDansNJours(1)

  const basePro = computeSetupProgress({
    servicesCount: 4, availabilitiesCount: 12, baseAddress: '3 Rue Sainte-Catherine, Bordeaux',
    phone: '0612345678', logoUrl: 'https://example.invalid/logo.png',
    googleCalendarConnected: true, reviewsEnabled: true, followupEnabled: true,
    zoneEnabled: true, smartSlotEnabled: true, welcomeMessage: 'Bienvenue chez Éclat Mobile !',
  })

  if (etat === 'quota') {
    // Écran 46 : trois demandes de plus, verrouillées par le plafond Starter — cliquables, elles
    // ouvrent la fiche floutée (écran 48) sans rien de plus à préparer ici.
    const verrouillees: ReservationMasquee[] = [
      { id: 'demo-accueil-verrou-1', scheduled_at: dansNJours(4, 11, 0) },
      { id: 'demo-accueil-verrou-2', scheduled_at: dansNJours(5, 9, 0) },
      { id: 'demo-accueil-verrou-3', scheduled_at: dansNJours(7, 14, 0) },
    ]
    return {
      rdvAujourdhui: [camille, marc, garage], rdvProchains: [thomas, sophie], aConfirmer: [sophie],
      verrouillees, journeeCommencee: false, dateDuJour, widgets: WIDGETS_DEMO,
      stats: { terminesCeMois: 11, caCeMois: 640 },
      clients: { total: 18, nouveauxCetteSemaine: 2 },
      trafic: { visiteurs: 34, conversions: 6 },
      prestationTop: { nom: 'Extérieur express', nombre: 9 },
      zone: ZONE_GIRONDE,
      jauge: { utilisees: 15, quota: 15, offre: 'starter', remiseAZero: '3 novembre' },
      offreDeblocage: 'Pro',
      semaine, rdvDemain: [thomas, sophie], demainStr,
      progress: basePro,
      configurationIncomplete: etapeDemarrage(basePro) !== null,
    }
  }

  // Écran 1 : journée normale, offre Pro, aucun plafond.
  return {
    rdvAujourdhui: [camille, marc, garage], rdvProchains: [thomas, sophie], aConfirmer: [sophie],
    verrouillees: [], journeeCommencee: false, dateDuJour, widgets: WIDGETS_DEMO,
    stats: { terminesCeMois: 11, caCeMois: 640 },
    clients: { total: 18, nouveauxCetteSemaine: 2 },
    trafic: { visiteurs: 34, conversions: 6 },
    prestationTop: { nom: 'Extérieur express', nombre: 9 },
    zone: ZONE_GIRONDE,
    jauge: { utilisees: 42, quota: null, offre: 'pro' },
    offreDeblocage: 'Pro',
    semaine, rdvDemain: [thomas, sophie], demainStr,
    progress: basePro,
    configurationIncomplete: etapeDemarrage(basePro) !== null,
  }
}

// ── Jeu de données pour « Agenda » (CalendrierDashboardV2), passe bureau (2026-10-06) ────────
//
// Sûr à brancher dans `/demo` : `useTrajetsRdv` appelle `/api/trajet` en GET, mais cette route
// exige une session (`if (!user) throw ... 401`, voir `api/trajet/route.ts`) — la page démo
// n'authentifie personne, donc chaque appel échoue tout de suite et ne coûte RIEN à Google.
// Toutes les autres actions de cet écran (statut, reprogrammation, facture, congés, rendez-vous
// manuel) passent par `fetch` non-GET, déjà bloquées par le verrou d'écriture de
// `DemoDashboard.tsx`.
//
// Équipe de deux (`teamSize: 2`), seule différence avec `jeuDeDonneesDemo()` (laveur seul) : il
// fallait un compte à plusieurs pour montrer la différence entre un jour FERMÉ (toute l'équipe
// en congé) et un congé PARTIEL (un laveur sur deux, le jour reste ouvert) — la grille semaine
// bureau les distingue (voir `GrilleSemaineV2` dans `CalendrierDashboardV2.tsx`).
//
// Les sept jours par défaut (aujourd'hui ± 3, la fenêtre que l'agenda affiche à l'ouverture)
// couvrent les quatre situations qu'Alexandre veut comparer : une journée bien remplie
// (aujourd'hui), une journée avec des demandes en attente (demain), une journée OUVERTE sans
// rien dedans (dans deux jours — la « journée vide », sans qu'aucun congé ne l'explique) et un
// congé partiel ce même jour-là, puis un jour FERMÉ (dans trois jours).

function versISOAgenda(offsetJours: number, heure: number, minute = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetJours)
  d.setHours(heure, minute, 0, 0)
  return d.toISOString()
}

function dateCivileAgendaA(offsetJours: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetJours)
  return d.toLocaleDateString('en-CA')
}

const AGENDA_SERVICE_EXPRESS = { name: 'Extérieur express', price: 35, duration_minutes: 25 }
const AGENDA_SERVICE_COMPLET = { name: 'Extérieur + intérieur', price: 59, duration_minutes: 50 }
const AGENDA_SERVICE_SIEGES = { name: 'Rénovation sièges', price: 120, duration_minutes: 90 }
const AGENDA_SERVICE_FLOTTE = { name: 'Forfait flotte', price: 210, duration_minutes: 90 }
const AGENDA_CATEGORIE_VOITURE = { name: 'Voiture' }

export function jeuDeDonneesAgendaDemo(): {
  bookings: Booking[]
  unavailabilities: Unavailability[]
  teamSize: number
  services: ServiceFull[]
  categories: Category[]
  washerId: string
  facturationPrete: boolean
  googleAgendaConnecte: boolean
  joursMasques: string[]
  masquees: { id: string; scheduled_at: string }[]
  offreDeblocage: string
} {
  const bookings: Booking[] = [
    {
      id: 'demo-agenda-claire', client_name: 'Claire Martin', client_email: 'claire.martin@gmail.com', client_phone: '0612345678',
      address: '4 Rue du Loup, Bordeaux', lat: 44.839, lng: -0.577,
      scheduled_at: versISOAgenda(-3, 9, 0), status: 'done', notes: null,
      is_smart_slot: false, smart_discount: 0, booked_price: 35, selected_addons: null, travel_fee: null,
      vehicle_count: 1, vehicles_detail: null, services: { ...AGENDA_SERVICE_EXPRESS, service_categories: AGENDA_CATEGORIE_VOITURE },
      facture_numero: 'F-00061', closed_late: false, is_professional: false,
    },
    {
      id: 'demo-agenda-antoine', client_name: 'Antoine Faure', client_email: 'antoine.faure@gmail.com', client_phone: '0623456789',
      address: '30 Rue Sainte-Croix, Bordeaux', lat: 44.835, lng: -0.57,
      scheduled_at: versISOAgenda(-2, 11, 0), status: 'done', notes: null,
      is_smart_slot: false, smart_discount: 0, booked_price: 59, selected_addons: null, travel_fee: null,
      vehicle_count: 1, vehicles_detail: null, services: { ...AGENDA_SERVICE_COMPLET, service_categories: AGENDA_CATEGORIE_VOITURE },
      facture_numero: 'F-00062', closed_late: false, is_professional: false,
    },
    {
      id: 'demo-agenda-nathalie', client_name: 'Nathalie Petit', client_email: 'nathalie.petit@gmail.com', client_phone: '0634567890',
      address: '9 Rue Fondaudège, Bordeaux', lat: 44.845, lng: -0.583,
      scheduled_at: versISOAgenda(-1, 9, 30), status: 'done', notes: null,
      is_smart_slot: false, smart_discount: 0, booked_price: 59, selected_addons: null, travel_fee: null,
      vehicle_count: 1, vehicles_detail: null, services: { ...AGENDA_SERVICE_COMPLET, service_categories: AGENDA_CATEGORIE_VOITURE },
      facture_numero: 'F-00063', closed_late: false, is_professional: false,
    },
    {
      id: 'demo-agenda-camille', client_name: 'Camille Lefebvre', client_email: 'camille.lefebvre@gmail.com', client_phone: '0671421853',
      address: '12 Rue Fondaudège, Bordeaux', lat: 44.846, lng: -0.586,
      scheduled_at: versISOAgenda(0, 14, 30), status: 'confirmed', notes: 'Portail code 2584, chien dans le jardin (gentil, juste bruyant).',
      is_smart_slot: false, smart_discount: 0, booked_price: 59, selected_addons: null, travel_fee: null,
      vehicle_count: 1, vehicles_detail: null, services: { ...AGENDA_SERVICE_COMPLET, service_categories: AGENDA_CATEGORIE_VOITURE },
      facture_numero: null, closed_late: false, is_professional: false,
    },
    {
      id: 'demo-agenda-marc', client_name: 'Marc Dubreuil', client_email: 'marc.dubreuil@gmail.com', client_phone: '0620304050',
      address: '8 Cours de la Marne, Bordeaux', lat: 44.834, lng: -0.561,
      scheduled_at: versISOAgenda(0, 16, 0), status: 'confirmed', notes: null,
      is_smart_slot: false, smart_discount: 0, booked_price: 35, selected_addons: null, travel_fee: null,
      vehicle_count: 1, vehicles_detail: null, services: { ...AGENDA_SERVICE_EXPRESS, service_categories: AGENDA_CATEGORIE_VOITURE },
      facture_numero: null, closed_late: false, is_professional: false,
    },
    {
      id: 'demo-agenda-garage', client_name: 'Garage Renault Mérignac', client_email: 'contact@garage-renault-merignac.fr', client_phone: '0556001122',
      address: '2 Avenue de Mérignac, Mérignac', lat: 44.839, lng: -0.651,
      scheduled_at: versISOAgenda(0, 17, 30), status: 'pending', notes: null,
      is_smart_slot: false, smart_discount: 0, booked_price: 210, selected_addons: null, travel_fee: null,
      vehicle_count: 3, vehicles_detail: [{ type: 'utilitaire', count: 3, unit_price: 70, label: 'Forfait flotte' }],
      services: { ...AGENDA_SERVICE_FLOTTE, service_categories: AGENDA_CATEGORIE_VOITURE },
      facture_numero: null, closed_late: false, is_professional: true,
    },
    {
      id: 'demo-agenda-thomas', client_name: 'Thomas Girard', client_email: 'thomas.girard@gmail.com', client_phone: '0623987654',
      address: '11 Rue du Hâ, Bordeaux', lat: 44.838, lng: -0.574,
      scheduled_at: versISOAgenda(1, 9, 0), status: 'pending', notes: null,
      is_smart_slot: false, smart_discount: 0, booked_price: 59, selected_addons: null, travel_fee: null,
      vehicle_count: 1, vehicles_detail: null, services: { ...AGENDA_SERVICE_COMPLET, service_categories: AGENDA_CATEGORIE_VOITURE },
      facture_numero: null, closed_late: false, is_professional: false,
    },
    {
      id: 'demo-agenda-sophie', client_name: 'Sophie Lambert', client_email: 'sophie.lambert@gmail.com', client_phone: '0634567123',
      address: '5 Rue Judaïque, Bordeaux', lat: 44.841, lng: -0.588,
      scheduled_at: versISOAgenda(1, 10, 0), status: 'pending', notes: null,
      is_smart_slot: false, smart_discount: 0, booked_price: 35, selected_addons: null, travel_fee: null,
      vehicle_count: 1, vehicles_detail: null, services: { ...AGENDA_SERVICE_EXPRESS, service_categories: AGENDA_CATEGORIE_VOITURE },
      facture_numero: null, closed_late: false, is_professional: false,
    },
    // Un rendez-vous annulé, visible mais estompé — même jour que Claire Martin : prouve que la
    // ligne reste dans la liste (jamais escamotée) sans compter dans les totaux ni les trajets.
    {
      id: 'demo-agenda-bastien', client_name: 'Bastien Leroy', client_email: 'bastien.leroy@gmail.com', client_phone: '0658224710',
      address: '8 Rue des Menuts, Bordeaux', lat: 44.831, lng: -0.572,
      scheduled_at: versISOAgenda(-3, 15, 0), status: 'cancelled', notes: null,
      is_smart_slot: false, smart_discount: 0, booked_price: 35, selected_addons: null, travel_fee: null,
      vehicle_count: 1, vehicles_detail: null, services: { ...AGENDA_SERVICE_EXPRESS, service_categories: AGENDA_CATEGORIE_VOITURE },
      facture_numero: null, closed_late: false, is_professional: false,
    },
    // Rénovation sièges, le mois prochain — pour que la vue « Mois » montre autre chose que la
    // semaine en cours.
    {
      id: 'demo-agenda-pierre', client_name: 'Pierre Moreau', client_email: 'pierre.moreau@moreauautodetail.fr', client_phone: '0611112222',
      address: '5 Rue des Artisans, Bordeaux', lat: 44.836, lng: -0.575,
      scheduled_at: versISOAgenda(16, 14, 0), status: 'confirmed', notes: null,
      is_smart_slot: false, smart_discount: 0, booked_price: 120, selected_addons: null, travel_fee: null,
      vehicle_count: 1, vehicles_detail: null, services: { ...AGENDA_SERVICE_SIEGES, service_categories: AGENDA_CATEGORIE_VOITURE },
      facture_numero: null, closed_late: false, is_professional: true,
    },
  ]

  // « Dans deux jours » reste un jour OUVERT sans rien dedans (aucune ligne ci-dessus, aucun
  // congé) : c'est la « journée vide ». Un laveur sur deux est noté absent ce même jour
  // (`team_members_off: 1` sur 2) — un congé PARTIEL, qui n'empêche pas de réserver, distinct du
  // jour suivant, FERMÉ (`team_members_off: 2`, toute l'équipe).
  const unavailabilities: Unavailability[] = [
    { id: 'demo-agenda-conge-partiel', start_date: dateCivileAgendaA(2), end_date: dateCivileAgendaA(2), label: 'Formation', team_members_off: 1 },
    { id: 'demo-agenda-conge-ferme', start_date: dateCivileAgendaA(3), end_date: dateCivileAgendaA(3), label: 'Repos', team_members_off: 2 },
    // Une période à venir, hors de la semaine affichée par défaut — pour que « Congés à venir »
    // et la vue « Mois » (bien après aujourd'hui) aient quelque chose à montrer.
    { id: 'demo-agenda-conge-vacances', start_date: dateCivileAgendaA(18), end_date: dateCivileAgendaA(21), label: 'Vacances', team_members_off: 2 },
  ]

  const services: ServiceFull[] = [
    { id: 'demo-agenda-s-express', name: AGENDA_SERVICE_EXPRESS.name, price: AGENDA_SERVICE_EXPRESS.price, duration_minutes: AGENDA_SERVICE_EXPRESS.duration_minutes, vehicle_price_overrides: {}, category_id: 'demo-agenda-cat-voiture', vehicle_types: ['citadine', 'berline', 'suv'] },
    { id: 'demo-agenda-s-complet', name: AGENDA_SERVICE_COMPLET.name, price: AGENDA_SERVICE_COMPLET.price, duration_minutes: AGENDA_SERVICE_COMPLET.duration_minutes, vehicle_price_overrides: {}, category_id: 'demo-agenda-cat-voiture', vehicle_types: ['citadine', 'berline', 'suv'] },
    { id: 'demo-agenda-s-sieges', name: AGENDA_SERVICE_SIEGES.name, price: AGENDA_SERVICE_SIEGES.price, duration_minutes: AGENDA_SERVICE_SIEGES.duration_minutes, vehicle_price_overrides: {}, category_id: 'demo-agenda-cat-voiture', vehicle_types: ['berline', 'suv'] },
    { id: 'demo-agenda-s-flotte', name: AGENDA_SERVICE_FLOTTE.name, price: AGENDA_SERVICE_FLOTTE.price, duration_minutes: AGENDA_SERVICE_FLOTTE.duration_minutes, vehicle_price_overrides: {}, category_id: 'demo-agenda-cat-voiture', vehicle_types: ['utilitaire'] },
  ]
  const categories: Category[] = [
    { id: 'demo-agenda-cat-voiture', name: 'Voiture', types: [{ id: 'citadine', name: 'Citadine' }, { id: 'berline', name: 'Berline' }, { id: 'suv', name: 'SUV' }, { id: 'utilitaire', name: 'Utilitaire' }] },
  ]

  return {
    bookings, unavailabilities, teamSize: 2, services, categories,
    washerId: 'demo-washer-agenda',
    facturationPrete: true,
    googleAgendaConnecte: true,
    joursMasques: [],
    masquees: [],
    offreDeblocage: 'Pro',
  }
}

// ── Jeu de données pour « Messages automatiques » (passe bureau, écrans 31/32) ───────────────
//
// Réutilise le MÊME fichier client et les MÊMES réglages que `jeuDeDonneesDemo()`
// (`automatismes.messages`) plutôt qu'une seconde fiction : « Automatismes » (dans Clients) et
// « Messages automatiques » (l'écran que sa ligne ouvre) doivent raconter la même chose.
// `MessagesAutomatiquesV2` attend des rendez-vous sous la forme `RdvMessage`, pas des
// réservations de fichier client (`ClientBooking`) — simple adaptation de type, aucun recalcul,
// qui reprend la même correspondance que `versRdvMessage` dans `ClientsViewV2.tsx` (dupliquée
// ici, pas importée : ce fichier reste un module de données pur, sans dépendre d'un composant
// `use client`).
export function jeuDeDonneesMessagesDemo(): MessagesAutomatiquesProps {
  const { bookings, automatismes, nomLaveur } = jeuDeDonneesDemo()
  const rdvs: RdvMessage[] = bookings.map(b => ({
    id: b.id,
    client_name: b.client_name,
    client_email: b.client_email || null,
    client_phone: b.client_phone,
    scheduled_at: b.scheduled_at,
    created_at: b.created_at ?? b.scheduled_at,
    status: b.status,
    is_professional: b.is_professional,
    company_name: b.company_name,
    services: b.services,
    followup_sent_at: b.followup_sent_at,
  }))
  return {
    reglages: automatismes.messages,
    smsAutorise: automatismes.smsAutorise,
    avisAutorise: automatismes.avisAutorise,
    libellePlanAvis: automatismes.libellePlanAvis,
    relanceAutorisee: automatismes.relanceAutorisee,
    libellePlanRelance: automatismes.libellePlanRelance,
    nomLaveur,
    expediteurSms: 'ECLATMOBILE',
    telephone: '0681001122',
    slug: 'demo-eclat-mobile',
    rdvs,
    lectureIncomplete: false,
  }
}

// ── Jeu de données pour « Publicités » et son « Bilan » (passe bureau, écrans 33/34) ─────────
//
// Reprend les chiffres de la maquette (`project/Publicites.dc.html`, `project/
// ChiffresAcquisition.dc.html`-like écrans 33/34) : deux campagnes, « Pub Rentrée » (Meta, en
// cours depuis 40 jours, budget saisi il y a 22 jours — au-delà des 14 jours de
// `BUDGET_A_VERIFIER_JOURS`, pour montrer l'avertissement ambre) et « Promo Flotte Garages »
// (Google, terminée). `bilanCampagne()`/`resteHorsCreations()` calculent les ratios — rien
// n'est tapé à la main, comme le ferait vraiment `lib/campagnesServeur.ts` à partir de la base.
export function jeuDeDonneesPublicitesDemo(): { campagnes: CampagneAffichee[] } {
  const videoClio: Creation = {
    id: 'demo-crea-clio', campagne_id: 'demo-camp-rentree', nom: 'Avant/après Clio',
    format: 'video', cle: 'avant-apres-clio', budget: null,
  }
  const videoInterieur: Creation = {
    id: 'demo-crea-interieur', campagne_id: 'demo-camp-rentree', nom: 'Intérieur poussiéreux',
    format: 'video', cle: 'interieur-poussiereux', budget: null,
  }
  const videoCoffre: Creation = {
    id: 'demo-crea-coffre', campagne_id: 'demo-camp-rentree', nom: 'Coffre utilitaire',
    format: 'image', cle: 'coffre-utilitaire', budget: null,
  }
  // Les deux premières vidéos totalisent 10 clients, le même nombre que la campagne : la
  // troisième n'a encore aucune visite identifiée (déclarée après coup, cas courant).
  const bilanClio: BilanCreation = {
    ...bilanCampagne({ budget: null, visites: 52, reservations: 7, chiffreAffaires: 410 }),
    creation: videoClio, partReservations: 70, fiable: true,
  }
  const bilanInterieur: BilanCreation = {
    ...bilanCampagne({ budget: null, visites: 34, reservations: 3, chiffreAffaires: 180 }),
    creation: videoInterieur, partReservations: 30, fiable: true,
  }
  const bilanCoffre: BilanCreation = {
    ...bilanCampagne({ budget: null, visites: 0, reservations: 0, chiffreAffaires: 0 }),
    creation: videoCoffre, partReservations: 0, fiable: false,
  }
  const creationsRentree = [bilanClio, bilanInterieur, bilanCoffre]
  const bilanRentree = bilanCampagne({ budget: 120, visites: 86, reservations: 10, chiffreAffaires: 590 })
  const bilanFlotte = bilanCampagne({ budget: 80, visites: 34, reservations: 3, chiffreAffaires: 210 })

  const rentree: CampagneAffichee = {
    id: 'demo-camp-rentree', nom: 'Pub Rentrée', plateforme: 'meta', budget: 120,
    cle: 'pub-rentree', debut: jourCivilILYA(40), fin: null, budget_maj_le: ilYA(22, 9, 0),
    bilan: bilanRentree,
    creations: creationsRentree,
    reste: resteHorsCreations(bilanRentree, creationsRentree),
  }
  const flotte: CampagneAffichee = {
    id: 'demo-camp-flotte', nom: 'Promo Flotte Garages', plateforme: 'google', budget: 80,
    cle: 'promo-flotte-garages', debut: jourCivilILYA(60), fin: jourCivilILYA(45), budget_maj_le: jourCivilILYA(45),
    bilan: bilanFlotte,
    creations: [],
    reste: resteHorsCreations(bilanFlotte, []),
  }

  return { campagnes: [rentree, flotte] }
}

// ── Jeu de données pour « Chiffres » et « Dépenses » (passe bureau, écrans 7/8/40/41) ────────
//
// `bookings` n'a pas besoin d'être refabriqué ici : `jeuDeDonneesDemo().bookings` (plus haut)
// satisfait déjà exactement le type attendu par `ChiffresV2` (`ChiffresBooking` = `ClientBooking`
// + deux champs optionnels que `ClientBooking` ne porte pas) — `DemoDashboard.tsx` le lui passe
// directement. Seules les visites (aucun équivalent ailleurs dans la démo) sont fabriquées
// ici, par un petit générateur déterministe plutôt qu'un historique écrit à la main : pas de
// `Math.random()`, pour que deux captures du même jour se ressemblent.
//
// Volontairement laissé à Pro (`hasCrm`/`hasCa`/`hasCompta` tous vrais) : cohérent avec le
// reste de `/demo` (`plan="pro"` dans DashboardShell) et avec le README de la maquette bureau
// (Julien Roussel est en Pro sur la plupart des écrans).
function genererEvenementsDemo(): ChiffresEvent[] {
  const events: ChiffresEvent[] = []
  // `undefined` → « direct » (voir `funnelStats.ts`, `buildReferrerBreakdown`).
  const referrers: (string | undefined)[] = ['google.com', 'instagram.com', undefined, 'facebook.com', 'google.com']
  const devices: Device[] = ['mobile', 'mobile', 'desktop', 'mobile', 'tablet']
  const joursEcoules = new Date().getDate() // jour du mois en cours, 1..31 : la période par défaut de Chiffres est « mois »
  let n = 0
  for (let offset = 0; offset < joursEcoules; offset++) {
    const jour = new Date()
    jour.setDate(jour.getDate() - offset)
    const dimanche = jour.getDay() === 0
    const sessionsDuJour = dimanche ? 1 : 2 + (offset % 3) // 1 le dimanche, 2 à 4 les autres jours
    for (let i = 0; i < sessionsDuJour; i++) {
      const idx = n
      n += 1
      const sessionId = `demo-visite-${idx}`
      const heure = 8 + (idx % 11) // étalé de 8 h à 18 h
      const createdAt = versISO(-offset, heure, (idx * 7) % 60)
      const referrer = referrers[idx % referrers.length]
      const device = devices[idx % devices.length]
      // Entonnoir déterministe, proche des proportions de la maquette (écran 8) : ~68 %
      // atteignent « Créneau », ~48 % « Coordonnées », ~15 % « Confirmation ».
      const marche = idx % 10
      events.push({ step: 'prestation', session_id: sessionId, created_at: createdAt, referrer_host: referrer, device })
      if (marche < 7) {
        events.push({ step: 'creneau', session_id: sessionId, created_at: createdAt, referrer_host: referrer, device })
        if (marche < 5) {
          events.push({ step: 'coordonnees', session_id: sessionId, created_at: createdAt, referrer_host: referrer, device })
          if (marche < 2) {
            events.push({ step: 'confirmation', session_id: sessionId, created_at: createdAt, referrer_host: referrer, device })
          }
        }
      }
    }
  }
  return events
}

// ── Jeu de données pour « Dépenses » (écran 41, et la section « Dépenses » de l'onglet
// Argent) ─────────────────────────────────────────────────────────────────────────────────
//
// Contrairement au reste de `/demo`, `DepensesV2` (et la section « Dépenses » de
// `ChiffresArgent`) ne reçoit pas ses données en props : il appelle lui-même
// `/api/expenses`/`/api/expenses/recurring`, des routes qui exigent une session que `/demo` ne
// fournit jamais (401 sans elle). Sans rien de plus, les deux écrans afficheraient une erreur de
// chargement plutôt que du contenu — voir `DemoDashboard.tsx`, qui intercepte ces deux lectures
// (jamais les écritures) pour leur répondre avec ce jeu de données au lieu d'atteindre le réseau.
export function jeuDeDonneesDepensesDemo(): { depenses: Depense[]; recurrents: DepenseRecurrente[] } {
  const recurrents: DepenseRecurrente[] = [
    { id: 'demo-rec-assurance', category: 'abonnement', label: 'Assurance véhicule', amount: 180, day_of_month: 1, active: true },
    { id: 'demo-rec-utilitaire', category: 'abonnement', label: 'Location utilitaire', amount: 240, day_of_month: 5, active: true },
  ]
  const depenses: Depense[] = [
    { id: 'demo-dep-buse', date: jourCivilILYA(2), category: 'equipement', label: 'Buse haute pression', amount: 95 },
    { id: 'demo-dep-plein1', date: jourCivilILYA(2), category: 'carburant', label: 'Plein, trajet Mérignac', amount: 65 },
    { id: 'demo-dep-produits', date: jourCivilILYA(3), category: 'produits', label: 'Produits de lavage', amount: 95 },
    { id: 'demo-dep-microfibres', date: jourCivilILYA(3), category: 'produits', label: 'Microfibres ×10', amount: 45 },
    {
      id: 'demo-dep-assurance', date: jourCivilILYA(4), category: 'abonnement', label: 'Assurance véhicule', amount: 180,
      recurring_expense_id: 'demo-rec-assurance',
    },
    { id: 'demo-dep-plein2', date: jourCivilILYA(4), category: 'carburant', label: 'Plein Total Bordeaux', amount: 120 },
    { id: 'demo-dep-housses', date: jourCivilILYA(5), category: 'equipement', label: 'Pare-soleil & housses', amount: 70 },
  ]
  return { depenses, recurrents }
}

export function jeuDeDonneesChiffresDemo(): {
  events: ChiffresEvent[]
  facturesManuelles: FactureManuelle[]
  facturesCount: number
  facturesImpayees: number
  websiteHost: string
  evenementsDepuis: string
  hasCrm: boolean
  hasCa: boolean
  hasCompta: boolean
} {
  return {
    events: genererEvenementsDemo(),
    // Aucune facture écrite à la main dans ce jeu de données : `encaissementsDesFactures([])`
    // reste un no-op, l'« Encaissé » ne dépend que des réservations déjà fabriquées pour
    // ClientsViewV2 — un seul jeu de vérité plutôt que deux listes à faire concorder à la main.
    facturesManuelles: [],
    facturesCount: 24,
    // Une facture impayée : fait apparaître la ligne en ambre dans la colonne de gauche de
    // l'onglet Argent (écran 7), sans quoi cet état ne se verrait jamais sur cette page.
    facturesImpayees: 1,
    websiteHost: 'eclatmobile.fr',
    evenementsDepuis: versISO(-365, 0),
    hasCrm: true,
    hasCa: true,
    hasCompta: true,
  }
}

// ── Jeu de données pour « Plus » (passe bureau, 2026-10-06) ────────────────────────────────
//
// Nourrit les six écrans de la destination « Plus » : la liste elle-même (`ParametresFormV2`,
// écran de repos) et les cinq réglages qu'elle ouvre — Mon profil, Mes liens, Prestations et
// prix, Horaires, Apparence de ma page. Même laveur fictif que le reste de `/demo` (Julien
// Roussel / Éclat Mobile, Bordeaux, offre Pro, `README.md` de la maquette bureau) : `nom` porte
// le nom de l'ENTREPRISE (« Éclat Mobile », ce que montre la page de réservation), distinct du
// nom PERSONNEL (« Julien Roussel », porté par `DashboardShell` — voir `RailBureauV2.tsx` pour
// la même distinction).
//
// Les prestations/catégories sont fabriquées dans la forme RÉELLE (`Service`/`ServiceCategory`,
// `types/index.ts`), pas la forme simplifiée de `jeuDeDonneesAgendaDemo()` (`ServiceFull`,
// pensée pour `CalendrierDashboardV1` seulement) : `PrestationsV2` lit `washer_id`,
// `description`, `addons`, que cette dernière ne porte pas.
export function jeuDeDonneesPlusDemo(): {
  listeBase: ReglagesListeProps
  apparence: ReglagesApparence
  prestations: {
    services: Service[]
    categories: ServiceCategory[]
    availabilities: Availability[]
    zone: ZoneConfig
    adresseDeBase: string | null
    plafond: number | null
    offre: Plan
  }
  horaires: {
    availabilities: Availability[]
    unavailabilities: UnavailabilityReelle[]
    teamSize: number
    jourMemeAutorise: boolean
    adresseDepart: boolean
  }
  profil: { washer: Washer; email: string; peutEquipe: boolean }
  slug: string
  /** Écran 62 (« Abonnement ») — convention de la maquette bureau (`README.md` : les écrans qui
   *  montrent justement une limite repassent Éclat Mobile en Starter, chiffres réels). Pro
   *  partout ailleurs sur cette page, Starter ICI seulement, pour que la jauge « 12 / 15 » et
   *  les boutons « Passer à Pro »/« Passer à Business » aient un sens — un Pro n'a aucun plafond
   *  (`lib/plan.ts`), l'écran serait vide de la moitié de ce qu'il doit montrer. */
  abonnement: Omit<PropsAbonnement, 'liste' | 'betaRefonte'>
  /** Écran 64 (« Aide et assistance ») : trois conversations, une ouverte avec deux messages
   *  (celle que la maquette montre sélectionnée), une résolue, une en attente de réponse. */
  assistanceThreads: SupportThread[]
} {
  const nom = 'Éclat Mobile'
  const slug = 'demo-eclat-mobile'
  const brandColor = '#1456D1'
  const plan: Plan = 'pro'

  const categories: ServiceCategory[] = [
    {
      id: 'demo-plus-cat-voiture', washer_id: 'demo-washer-plus', name: 'Voiture', display_order: 0,
      types: [{ id: 'citadine', name: 'Citadine' }, { id: 'berline', name: 'Berline' }, { id: 'suv', name: 'SUV' }],
    },
  ]
  const services: Service[] = [
    {
      id: 'demo-plus-s-express', washer_id: 'demo-washer-plus', category_id: 'demo-plus-cat-voiture',
      name: SERVICE_EXPRESS.name, description: null, price: SERVICE_EXPRESS.price, duration_minutes: SERVICE_EXPRESS.duration_minutes,
      vehicle_types: ['citadine', 'berline', 'suv'], vehicle_price_overrides: {}, addons: [],
    },
    {
      id: 'demo-plus-s-complet', washer_id: 'demo-washer-plus', category_id: 'demo-plus-cat-voiture',
      name: SERVICE_COMPLET.name, description: null, price: SERVICE_COMPLET.price, duration_minutes: SERVICE_COMPLET.duration_minutes,
      vehicle_types: ['citadine', 'berline', 'suv'], vehicle_price_overrides: {}, addons: [],
    },
    {
      id: 'demo-plus-s-sieges', washer_id: 'demo-washer-plus', category_id: 'demo-plus-cat-voiture',
      name: SERVICE_SIEGES.name, description: null, price: SERVICE_SIEGES.price, duration_minutes: SERVICE_SIEGES.duration_minutes,
      vehicle_types: ['berline', 'suv'], vehicle_price_overrides: {}, addons: [],
    },
    {
      id: 'demo-plus-s-flotte', washer_id: 'demo-washer-plus', category_id: 'demo-plus-cat-voiture',
      name: 'Forfait flotte', description: null, price: 70, duration_minutes: 90,
      vehicle_types: ['utilitaire'], vehicle_price_overrides: {}, addons: [],
    },
  ]

  // Lundi (1) → vendredi (5) 8h–18h, samedi (6) 9h–13h — dimanche (0) fermé, comme le reste de
  // `/demo` (voir `jeuDeDonneesAgendaDemo`, même semaine de référence).
  const availabilities: Availability[] = [1, 2, 3, 4, 5].map(jour => ({
    id: `demo-plus-dispo-${jour}`, washer_id: 'demo-washer-plus', day_of_week: jour, start_time: '08:00', end_time: '18:00',
  })).concat([
    { id: 'demo-plus-dispo-6', washer_id: 'demo-washer-plus', day_of_week: 6, start_time: '09:00', end_time: '13:00' },
  ])
  const unavailabilities: UnavailabilityReelle[] = [
    {
      id: 'demo-plus-conge', washer_id: 'demo-washer-plus', start_date: jourCivilDansNJours(18), end_date: jourCivilDansNJours(21),
      label: 'Vacances', team_members_off: 2, created_at: versISO(-30, 9),
    },
  ]

  const listeBase: ReglagesListeProps = {
    nom, slug, brandColor, plan, grandfathered: false,
  }

  const profilWasher: Washer = {
    id: 'demo-washer-plus', user_id: 'demo-user-plus', name: nom, slug, phone: '06 12 34 56 78',
    logo_url: null, welcome_message: 'Bienvenue chez Éclat Mobile !', brand_color: brandColor,
    zone_config: { enabled: true, type: 'road', center_address: 'Bordeaux, France', radius_km: 15 },
    google_refresh_token: null, team_size: 2,
    smart_slot_enabled: true, smart_slot_radius_minutes: 20, smart_slot_discount_type: 'percent', smart_slot_discount_value: 10,
    reservation_jour_meme: true, travel_fee_tiers: [], base_address: '12 Rue Fondaudège, Bordeaux',
    travel_fee_mode: 'base', background_theme: null, website_url: 'https://eclatmobile.fr',
    account_status: 'active', deletion_scheduled_at: null, plan, grandfathered: false,
    review_enabled: true, review_delay_hours: 3, google_review_url: 'https://g.page/r/demo', review_channel: 'sms',
    sms_sender: 'EclatMobile', followup_enabled: true, followup_delay_days: 90, followup_message: null,
    created_at: versISO(-400, 9),
    cgv_acceptees_le: versISO(-400, 9), cgv_acceptees_ip: null,
    facture_statut: 'ei', facture_nom_legal: 'Julien Roussel', facture_siret: '123 456 789 00012',
    facture_adresse: '12 Rue Fondaudège, 33000 Bordeaux', facture_forme_juridique: null, facture_capital: null,
    facture_immatriculation: null, facture_regime_tva: 'franchise', facture_taux_tva: 0, facture_numero_tva: null,
    facture_prochain_numero: 64, beta_refonte: true,
  }

  // Washer Starter, pour l'écran « Abonnement » seulement (voir le commentaire du type
  // ci-dessus) — mêmes fonctions pures que la vraie page (`lib/plan.ts`), aucun chiffre écrit
  // à la main : la jauge et le bouton « Passer à » resteraient corrects même si `BOOKING_QUOTA`
  // changeait demain.
  const washerStarter = { plan: 'starter' as const, grandfathered: false, created_at: versISO(-70, 9) }
  const abonnement: Omit<PropsAbonnement, 'liste' | 'betaRefonte'> = {
    subscriptionStatus: 'active',
    trialEndsAt: null,
    subscriptionEndsAt: null,
    plan: 'starter',
    grandfathered: false,
    doitChoisir: false,
    plafondReservations: quotaReservations(washerStarter),
    reservationsCeMois: 12,
    plafondPrestations: quotaPrestations(washerStarter),
    prestationsAuCatalogue: services.length,
    remiseAZero: libelleRemiseAZero(washerStarter.created_at),
  }

  const assistanceThreads: SupportThread[] = [
    {
      id: 'demo-fil-siret',
      title: 'Changer mon SIRET sur mes factures',
      status: 'ouverte',
      vuParEquipe: true,
      nonLuesCount: 0,
      messages: [
        { id: 'demo-msg-1', from: 'laveur', text: 'Bonjour, je viens de passer en EURL, comment je mets à jour mon SIRET sur mes factures ?', createdAt: versISO(-5, 18, 40) },
        { id: 'demo-msg-2', from: 'equipe', text: 'Bonjour Julien ! Rendez-vous dans Mon profil → Facturation, vous pouvez modifier votre SIRET et votre forme juridique directement. Les factures déjà émises ne changent pas.', createdAt: versISO(-5, 19, 5) },
        { id: 'demo-msg-3', from: 'laveur', text: 'Parfait, et le numéro de TVA si je deviens assujetti plus tard ?', createdAt: versISO(-5, 19, 7) },
        { id: 'demo-msg-4', from: 'equipe', text: 'Même endroit, un champ apparaît dès que vous passez sur « Je facture la TVA ». On reste dispo si besoin !', createdAt: versISO(-4, 9, 12) },
      ],
    },
    {
      id: 'demo-fil-instagram',
      title: 'Mon lien ne s’affiche pas sur Instagram',
      status: 'resolue',
      vuParEquipe: true,
      nonLuesCount: 0,
      messages: [
        { id: 'demo-msg-5', from: 'laveur', text: 'Mon lien de réservation ne s’ouvre pas quand je le mets en story.', createdAt: versISO(-12, 10, 0) },
        { id: 'demo-msg-6', from: 'equipe', text: 'Essayez de recopier le lien plutôt que « coller » depuis l’app Instagram, elle raccourcit parfois l’adresse. Dites-nous si ça persiste !', createdAt: versISO(-12, 11, 30) },
      ],
    },
    {
      id: 'demo-fil-tva',
      title: 'Ajouter mon numéro de TVA',
      status: 'resolue',
      vuParEquipe: true,
      nonLuesCount: 0,
      messages: [
        { id: 'demo-msg-7', from: 'laveur', text: 'Où est-ce que j’ajoute mon numéro de TVA ?', createdAt: versISO(-20, 8, 0) },
        { id: 'demo-msg-8', from: 'equipe', text: 'Dans Mon profil → Facturation, une fois « Je facture la TVA » activé.', createdAt: versISO(-20, 9, 0) },
        { id: 'demo-msg-9', from: 'laveur', text: 'Merci, c’est noté !', createdAt: versISO(-20, 9, 5) },
      ],
    },
  ]

  return {
    listeBase,
    apparence: {
      logoUrl: null, couleur: brandColor, fond: null,
      message: 'Bienvenue chez Éclat Mobile !', site: 'https://eclatmobile.fr',
    },
    prestations: {
      services, categories, availabilities,
      zone: profilWasher.zone_config, adresseDeBase: profilWasher.base_address, plafond: null, offre: plan,
    },
    horaires: {
      availabilities, unavailabilities, teamSize: 2, jourMemeAutorise: true, adresseDepart: true,
    },
    profil: { washer: profilWasher, email: 'julien@eclatmobile.fr', peutEquipe: true },
    slug,
    abonnement,
    assistanceThreads,
  }
}

// ── Jeu de données pour « Documents » (passe « Documents bureau », 2026-10-07) ───────────────
//
// `DocumentsV2` attend des `Document[]` COMPLETS (`lib/documents.ts`) — vendeur, lignes, totaux,
// pas seulement les quelques champs que `ClientDocument` porte pour la fiche client. Les CINQ
// documents déjà fabriqués plus haut pour `jeuDeDonneesDemo()` (D-00041 Thomas Girard, D-00043
// Maxime Dupuis, F-00037 Chloé Lefebvre, F-00038 Sophie Marchand, F-00039 Karim Benali) sont
// repris ICI avec les mêmes numéros, clients et montants — plutôt que d'inventer un second jeu
// qui raconterait autre chose sur le même numéro, ce qui aurait rendu le fichier client et
// l'écran Documents incohérents entre eux dès qu'on passe de l'un à l'autre dans `/demo`. Neuf
// documents de plus couvrent les statuts que ces cinq-là ne montrent pas encore (devis à
// envoyer, accepté, refusé, expiré ; facture impayée) — mêmes clients que les réservations de
// `jeuDeDonneesDemo()` quand c'est plausible, pour la même raison de cohérence.
const VENDEUR_DOCUMENTS_DEMO = {
  nomLegal: 'Julien Roussel',
  nomCommercial: 'Éclat Mobile',
  siret: '12345678900012',
  adresse: '12 Rue Fondaudège, 33000 Bordeaux',
  telephone: '0612345678',
  regimeTva: 'franchise' as const,
  tauxTva: 0,
  numeroTva: null,
  statut: 'ei' as const,
  formeJuridique: null,
  capital: null,
  immatriculation: null,
  logoUrl: null,
  couleur: '#1456D1',
}

function ligneDocumentDemo(designation: string, prixUnitaireTtc: number, quantite = 1): LigneFacture {
  return { designation, quantite, prixUnitaireTtc, totalTtc: Math.round(quantite * prixUnitaireTtc * 100) / 100 }
}

/** Construit un `Document` complet à partir de ce qu'un cas de démo a besoin de préciser — le
 *  reste (vendeur, régime de TVA, totaux) est calculé par les mêmes fonctions pures que la
 *  vraie construction d'un document (`totauxFacture`, `lib/facture.ts`), jamais recopié à la
 *  main : un montant qui ne retomberait pas juste se verrait tout de suite sur la fiche
 *  (section « Lignes » contre « Total »). */
function documentDemo(args: {
  id: string
  numero: string
  genre: GenreDocument
  statut: StatutDocument
  emisLe: string
  clientNom: string
  clientEmail: string
  clientTelephone?: string | null
  professionnel?: boolean
  entreprise?: string | null
  adresse: string
  vehicule?: string | null
  lignes: LigneFacture[]
  envoyeLe?: string | null
  renponduLe?: string | null
  valableJusquau?: string | null
  payeLe?: string | null
  factureId?: string | null
  devisId?: string | null
  datePrestation?: string | null
  lieu?: string
  note?: string | null
}): Document {
  const brut = totalLignes(args.lignes)
  return {
    id: args.id,
    genre: args.genre,
    statut: args.statut,
    numero: args.numero,
    emis_le: args.emisLe,
    envoye_le: args.envoyeLe ?? null,
    valable_jusquau: args.genre === 'devis' ? (args.valableJusquau ?? null) : null,
    repondu_le: args.renponduLe ?? null,
    paye_le: args.genre === 'facture' ? (args.payeLe ?? null) : null,
    facture_id: args.factureId ?? null,
    devis_id: args.devisId ?? null,
    created_at: args.emisLe,
    contenu: {
      version: 1,
      genre: args.genre,
      vendeur: VENDEUR_DOCUMENTS_DEMO,
      client: {
        nom: args.clientNom,
        email: args.clientEmail,
        telephone: args.clientTelephone ?? null,
        professionnel: args.professionnel ?? false,
        entreprise: args.professionnel ? (args.entreprise ?? null) : null,
        siren: null,
        adresseFacturation: args.adresse,
        vehicule: args.vehicule ?? null,
      },
      prestation: { date: args.datePrestation ?? null, lieu: args.lieu ?? args.adresse, nature: 'Prestation de services' },
      lignes: args.lignes,
      remiseTtc: 0,
      totaux: totauxFacture(brut, 'franchise', 0),
      valableJusquau: args.genre === 'devis' ? (args.valableJusquau ?? null) : null,
      note: args.note ?? null,
    },
  }
}

export function jeuDeDonneesDocumentsDemo(): {
  documents: Document[]
  prestations: { id: string; name: string; price: number }[]
} {
  const documents: Document[] = [
    // — Les cinq déjà connus de la fiche client (mêmes numéros, clients, montants) —
    documentDemo({
      id: 'demo-doc-d41', numero: 'D-00041', genre: 'devis', statut: 'envoye', emisLe: ilYA(4, 9, 0),
      envoyeLe: ilYA(4, 9, 5),
      clientNom: 'Thomas Girard', clientEmail: 'thomas.girard@gmail.com', clientTelephone: '0623987654',
      adresse: '11 Rue du Hâ, 33000 Bordeaux', vehicule: 'Renault Clio',
      lignes: [ligneDocumentDemo(SERVICE_SIEGES.name, 120)],
      valableJusquau: jourCivilDansNJours(26),
    }),
    documentDemo({
      id: 'demo-doc-d43', numero: 'D-00043', genre: 'devis', statut: 'envoye', emisLe: ilYA(6, 14, 0),
      envoyeLe: ilYA(6, 14, 5),
      clientNom: 'Maxime Dupuis', clientEmail: 'maxime.dupuis@gmail.com', clientTelephone: '0656123498',
      adresse: '17 Rue Boudet, 33000 Bordeaux', vehicule: 'Citroën C4',
      lignes: [ligneDocumentDemo(SERVICE_COMPLET.name, 59)],
      valableJusquau: jourCivilDansNJours(24),
    }),
    documentDemo({
      id: 'demo-doc-f37', numero: 'F-00037', genre: 'facture', statut: 'emis', emisLe: ilYA(22, 10, 0),
      envoyeLe: ilYA(22, 10, 5), payeLe: ilYA(18, 9, 0),
      clientNom: 'Chloé Lefebvre', clientEmail: 'chloe.lefebvre@gmail.com', clientTelephone: '0667891234',
      adresse: '4 Rue des Faussets, 33000 Bordeaux', vehicule: 'Fiat 500',
      lignes: [ligneDocumentDemo(SERVICE_COMPLET.name, 59)], datePrestation: jourCivilILYA(22),
    }),
    documentDemo({
      id: 'demo-doc-f38', numero: 'F-00038', genre: 'facture', statut: 'emis', emisLe: ilYA(40, 10, 0),
      envoyeLe: ilYA(40, 10, 5), payeLe: ilYA(33, 9, 0),
      clientNom: 'Sophie Marchand', clientEmail: 'sophie.marchand@flotte-bordeaux.fr', clientTelephone: '0610000002',
      professionnel: true, entreprise: 'Flotte Déplacement Bordeaux',
      adresse: '8 Avenue des Transports, 33700 Mérignac',
      lignes: [ligneDocumentDemo(SERVICE_EXPRESS.name, 35)], datePrestation: jourCivilILYA(40),
    }),
    documentDemo({
      id: 'demo-doc-f39', numero: 'F-00039', genre: 'facture', statut: 'emis', emisLe: ilYA(60, 10, 0),
      envoyeLe: ilYA(60, 10, 5), payeLe: ilYA(52, 9, 0),
      clientNom: 'Karim Benali', clientEmail: 'karim.benali@flotte-bordeaux.fr', clientTelephone: '0610000001',
      professionnel: true, entreprise: 'Flotte Déplacement Bordeaux',
      adresse: '12 Rue du Hangar, 33300 Bordeaux',
      lignes: [ligneDocumentDemo('Forfait flotte · 3 véhicules', 70, 3)], datePrestation: jourCivilILYA(60),
    }),

    // — Neuf de plus, pour que chaque filtre (type, état, période, client, montant) trouve
    // vraiment quelque chose à montrer ou à exclure —
    documentDemo({
      id: 'demo-doc-d44', numero: 'D-00044', genre: 'devis', statut: 'accepte', emisLe: ilYA(10, 9, 0),
      envoyeLe: ilYA(10, 9, 5), renponduLe: ilYA(8, 11, 0),
      clientNom: 'Camille Lambert', clientEmail: 'camille.lambert@gmail.com', clientTelephone: '0690123456',
      adresse: '14 Rue Lecocq, 33000 Bordeaux',
      lignes: [ligneDocumentDemo('Rénovation sièges tissu', 150)],
      valableJusquau: jourCivilDansNJours(20),
    }),
    documentDemo({
      id: 'demo-doc-d45', numero: 'D-00045', genre: 'devis', statut: 'refuse', emisLe: ilYA(25, 9, 0),
      envoyeLe: ilYA(25, 9, 5), renponduLe: ilYA(22, 10, 0),
      clientNom: 'Marc Lefevre', clientEmail: 'marc.lefevre@orange.fr', clientTelephone: '0623456789',
      adresse: '15 Rue Judaïque, 33000 Bordeaux',
      lignes: [ligneDocumentDemo('Polish carrosserie', 80)],
      valableJusquau: jourCivilDansNJours(5),
    }),
    documentDemo({
      id: 'demo-doc-d46', numero: 'D-00046', genre: 'devis', statut: 'emis', emisLe: ilYA(1, 9, 0),
      clientNom: 'Nathalie Robert', clientEmail: 'nathalie.robert@yahoo.fr', clientTelephone: '0645678901',
      adresse: '9 Rue Fondaudège, 33000 Bordeaux',
      lignes: [ligneDocumentDemo('Shampouinage sièges', 45)],
      valableJusquau: jourCivilDansNJours(29),
    }),
    documentDemo({
      id: 'demo-doc-d56', numero: 'D-00056', genre: 'devis', statut: 'envoye', emisLe: ilYA(40, 9, 0),
      envoyeLe: ilYA(40, 9, 5),
      clientNom: 'Antoine Michel', clientEmail: 'antoine.michel@gmail.com', clientTelephone: '0689012345',
      adresse: '30 Rue Sainte-Croix, 33000 Bordeaux',
      lignes: [ligneDocumentDemo('Rénovation plastiques', 95)],
      // Déjà périmé (date de validité dans le passé) : se lit « Expiré », pas « En attente de
      // réponse » (voir `devisExpire()`, `lib/documents.ts`) — un cas que les cinq documents
      // existants ne couvraient pas.
      valableJusquau: jourCivilILYA(5),
    }),
    documentDemo({
      id: 'demo-doc-f40', numero: 'F-00040', genre: 'facture', statut: 'emis', emisLe: ilYA(5, 9, 0),
      envoyeLe: ilYA(5, 9, 5),
      clientNom: 'Léa Mercier', clientEmail: 'lea.mercier@gmail.com', clientTelephone: '0612309876',
      adresse: '6 Rue des Trois Conils, 33000 Bordeaux',
      lignes: [ligneDocumentDemo(SERVICE_COMPLET.name, 59)], datePrestation: jourCivilILYA(5),
      // `payeLe` absent : impayée — c'est elle qui doit faire monter le total « dont … impayés ».
    }),
    documentDemo({
      id: 'demo-doc-f42', numero: 'F-00042', genre: 'facture', statut: 'emis', emisLe: ilYA(70, 9, 0),
      envoyeLe: ilYA(70, 9, 5),
      clientNom: 'David Rousseau', clientEmail: 'david.rousseau@rousseau-immo.fr', clientTelephone: '0699998888',
      professionnel: true, entreprise: 'Rousseau Immobilier',
      adresse: '20 Cours de l’Intendance, 33000 Bordeaux',
      lignes: [ligneDocumentDemo(SERVICE_COMPLET.name, 59)], datePrestation: jourCivilILYA(70),
    }),
    documentDemo({
      id: 'demo-doc-f47', numero: 'F-00047', genre: 'facture', statut: 'emis', emisLe: ilYA(2, 9, 0),
      envoyeLe: ilYA(2, 9, 5), payeLe: ilYA(1, 10, 0),
      clientNom: 'Pierre Moreau', clientEmail: 'pierre.moreau@moreauautodetail.fr', clientTelephone: '0611112222',
      professionnel: true, entreprise: 'Moreau Auto Détailing',
      adresse: '5 Rue des Artisans, 33000 Bordeaux', vehicule: 'Porsche Cayenne',
      lignes: [ligneDocumentDemo(SERVICE_SIEGES.name, 120)], datePrestation: jourCivilILYA(2),
    }),
    documentDemo({
      id: 'demo-doc-f50', numero: 'F-00050', genre: 'facture', statut: 'emis', emisLe: ilYA(40, 9, 0),
      envoyeLe: ilYA(40, 9, 5), payeLe: ilYA(36, 10, 0),
      clientNom: 'Hugo Garnier', clientEmail: 'hugo.garnier@gmail.com', clientTelephone: '0645123789',
      adresse: '33 Rue Saint-James, 33000 Bordeaux',
      lignes: [ligneDocumentDemo(SERVICE_COMPLET.name, 59)], datePrestation: jourCivilILYA(40),
    }),
  ]

  const prestations = [
    { id: 'demo-doc-prestation-express', name: SERVICE_EXPRESS.name, price: SERVICE_EXPRESS.price },
    { id: 'demo-doc-prestation-complet', name: SERVICE_COMPLET.name, price: SERVICE_COMPLET.price },
    { id: 'demo-doc-prestation-sieges', name: SERVICE_SIEGES.name, price: SERVICE_SIEGES.price },
  ]

  return { documents, prestations }
}

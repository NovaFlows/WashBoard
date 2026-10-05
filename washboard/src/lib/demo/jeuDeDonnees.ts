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

import type { ClientBooking, ClientDocument, ClientReglages } from '@/lib/clientProfile'
import type { ReglagesRelance } from '@/lib/clientsARelancer'
import type { EntrepriseListItem } from '@/lib/entrepriseProfile'
import type { AutomatismesClients } from '@/components/dashboard/AutomatismesClientsV2'

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
    campagnes: [
      { debut: jourCivilILYA(18), fin: null, budget_maj_le: ilYA(2, 9, 0) },
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

  return { bookings, documents, reglages, reglagesMessages, entreprises, nomLaveur: 'Julien Roussel', automatismes }
}

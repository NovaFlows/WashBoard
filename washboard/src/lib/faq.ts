// Questions/réponses de la FAQ de la page d'accueil.
//
// Source unique : affichée telle quelle dans `LandingPage.tsx` (section
// #faq) ET utilisée pour générer le JSON-LD `FAQPage` dans `siteJsonLd.ts`.
// Un seul endroit à modifier pour changer une question — impossible que le
// balisage envoyé à Google diverge du texte que lit un visiteur, ce qui est
// précisément ce que les moteurs sanctionnent sur ce type de balisage.
//
// Aucun chiffre commercial n'est écrit à la main ici : l'engagement annuel
// annonçait « 2 mois offerts » alors qu'Alexandre avait ramené l'offre à un
// mois le 2026-09-03 (ed5b235), prix affiché compris. La FAQ promettait donc
// depuis trois semaines un mois de plus que ce que le produit accorde. Elle
// lit maintenant `freeMonthsLabel()` : le jour où la formule change, la
// réponse change avec elle.

import { freeMonthsLabel, PLAN_CARDS } from '@/lib/plan'

export type FaqItem = { q: string; a: string }

// Dérivé de PLAN_CARDS, jamais recopié : ces prix suivent leur propre
// changement, comme freeMonthsLabel() plus bas — voir le commentaire de
// fichier. Grille 2026 : quatre offres, voir plan.ts pour la source.
//
// Fusion du 2026-09-28 : cette ligne visait `essentiel`, clé qui n'existe
// plus depuis la grille à 4 offres — un `!.price` sur `undefined` aurait fait
// planter le rendu de la page d'accueil en production. Remplacée par les deux
// offres réellement citées dans les réponses ci-dessous.
const starterPrice = PLAN_CARDS.find(c => c.key === 'starter')!.price
const proPrice = PLAN_CARDS.find(c => c.key === 'pro')!.price

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: 'Mes clients doivent créer un compte ?',
    a: 'Non. Ils réservent directement sur ta page, sans compte, sans appli. Juste leur nom, email et téléphone.',
  },
  {
    q: 'C\'est long à configurer ?',
    a: 'Non. En 10 minutes tu as ta page de réservation avec tes services, tes horaires et ta zone.',
  },
  {
    q: 'Les frais de déplacement sont calculés comment ?',
    a: 'Tu définis tes propres paliers de prix selon la durée du trajet en voiture, calculée automatiquement via Google Maps. Le point de départ, c\'est soit ton adresse de base, soit ton dernier rendez-vous du jour — à toi de choisir dans tes paramètres.',
  },
  {
    q: 'Ça marche pour d\'autres métiers que le lavage auto ?',
    a: 'Oui. Tu crées tes propres catégories et prestations, avec leurs durées et leurs prix : ménage, canapés, vitres, piscines… WashBoard n\'impose aucun métier.',
  },
  {
    q: 'Je peux faire du lavage auto et du ménage en même temps, avec un seul compte ?',
    a: 'Oui. Ce ne sont pas deux offres séparées : dans tes paramètres, tu ajoutes autant de catégories que tu veux, chacune avec ses propres prestations, durées et prix. Tes clients réservent sur la même page, quel que soit ce qu\'ils demandent.',
  },
  {
    q: 'Comment mes clients trouvent ma page ?',
    a: 'Tu partages ton lien partout : bio Instagram, TikTok, fiche Google, ton site, WhatsApp. Des liens dédiés à chaque réseau te montrent ensuite d\'où viennent tes réservations.',
  },
  {
    q: 'Je suis prévenu quand un client réserve ?',
    a: 'Oui, par email à chaque réservation. Et si tu installes WashBoard sur ton téléphone, aussi en notification (en bêta).',
  },
  {
    q: 'Je peux utiliser WashBoard uniquement depuis mon téléphone ?',
    a: 'Oui, le tableau de bord est pensé pour ça : agenda et clients s\'utilisent aussi bien depuis un mobile que depuis un ordinateur (la comptabilité aussi, en formule Pro). Tu peux même l\'installer sur ton écran d\'accueil comme une application, pour l\'ouvrir en un geste entre deux prestations.',
  },
  {
    q: 'Que se passe-t-il après le mois gratuit ?',
    a: `Tu choisis une formule : Starter à ${starterPrice}€/mois ou Pro à ${proPrice}€/mois. Si tu ne choisis pas, ton compte passe tout seul sur l'offre Découverte : gratuite, limitée à 5 réservations par mois. On ne coupe rien. Aucune carte n'est demandée pendant l'essai.`,
  },
  {
    q: 'Je peux arrêter quand je veux ?',
    a: `En mensuel, oui : sans engagement. L'annuel t'engage sur 12 mois, avec ${freeMonthsLabel()}.`,
  },
  {
    q: 'Ça marche avec une équipe ?',
    a: 'Oui, avec la formule Business. Tu indiques la taille de ton équipe et les absences, WashBoard accepte autant de rendez-vous en même temps que tu as de personnes disponibles.',
  },
  {
    q: 'Les clients peuvent payer en ligne ?',
    a: 'Non, le paiement reste sur place. WashBoard gère la réservation — le règlement, c\'est entre toi et ton client.',
  },
  {
    q: 'Et la facturation électronique obligatoire en 2027 ?',
    a: 'À partir du 1ᵉʳ septembre 2027, deux choses changent. Si tu factures des entreprises, tes factures devront être transmises dans un format électronique via une plateforme agréée par l\'État — tes factures WashBoard ont déjà toutes les mentions obligatoires, on travaille sur ce raccordement, sans engagement de date pour l\'instant. Si tu ne factures que des particuliers (le cas de la plupart des laveurs), tu n\'as pas ce format à produire, mais tu devras transmettre à l\'administration un résumé périodique de tes ventes — c\'est l\'e-reporting, et la franchise de TVA n\'en dispense pas. WashBoard n\'y est pas raccordé aujourd\'hui ; on te dira où on en est bien avant l\'échéance.',
  },
  {
    q: 'Et mes données ?',
    a: 'Elles restent les tiennes. Tu peux supprimer ton compte à tout moment depuis tes paramètres : tout est effacé sous 30 jours.',
  },
]

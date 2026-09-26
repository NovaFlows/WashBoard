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

import { freeMonthsLabel } from '@/lib/plan'

export type FaqItem = { q: string; a: string }

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
    q: 'Ça marche pour d\'autres métiers que le lavage auto ?',
    a: 'Oui. Tu crées tes propres catégories et prestations, avec leurs durées et leurs prix : ménage, canapés, vitres, piscines… WashBoard n\'impose aucun métier.',
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
    q: 'Que se passe-t-il après le mois gratuit ?',
    a: 'Tu choisis de continuer à 49€/mois ou non. Ton compte est suspendu sans frais si tu arrêtes. Aucune carte n\'est demandée pendant l\'essai.',
  },
  {
    q: 'Je peux arrêter quand je veux ?',
    a: `En mensuel, oui : sans engagement. L'annuel t'engage sur 12 mois, en échange de ${freeMonthsLabel()}.`,
  },
  {
    q: 'Ça marche avec une équipe ?',
    a: 'Oui, avec la formule Pro. Tu indiques la taille de ton équipe et les absences, WashBoard accepte autant de rendez-vous en même temps que tu as de personnes disponibles.',
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

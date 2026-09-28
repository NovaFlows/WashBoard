import { SMS_QUOTA } from '@/lib/plan'

// Contenu du comparatif « à la main / outil généraliste / WashBoard », utilisé
// à la fois sur la page dédiée (/meilleur-logiciel-lavage-auto) et, en
// doublon volontaire, dans la landing juste après l'énumération des
// fonctionnalités — voir `src/app/meilleur-logiciel-lavage-auto/page.tsx`
// pour le détail des sources de chaque affirmation.

export const besoinsHead = [
  'Besoin',
  'À la main (WhatsApp, Excel, carnet papier)',
  'Outil généraliste (Calendly, Google Agenda seul)',
  'WashBoard',
]

export const besoinsRows: string[][] = [
  [
    'Réservation en ligne, sans échange de messages',
    'Non — chaque créneau se négocie par message',
    'Oui, pour un outil de prise de rendez-vous comme Calendly',
    'Oui',
  ],
  [
    'Prix qui suit le type de véhicule (citadine, SUV, utilitaire…)',
    'Recalculé à la main à chaque fois',
    'Non — un rendez-vous a une durée et un prix uniques',
    'Oui, prix et durée par prestation et par véhicule',
  ],
  [
    'Frais de déplacement calculés automatiquement',
    'Non',
    'Non — pas prévu pour un métier qui se déplace',
    'Oui, par palier de trajet réel (Google Maps)',
  ],
  [
    'Créneaux qui limitent les trajets entre deux adresses',
    'Non',
    'Non — créneaux fixes, sans lien avec la géographie',
    'Oui, groupés au temps de trajet réel',
  ],
  [
    'Facturation conforme (SIRET, TVA, numérotation continue)',
    'Non — à refaire à part',
    'Non',
    'Oui, générée et envoyée automatiquement',
  ],
  [
    'Avis Google demandés après chaque prestation',
    'Non — à faire penser à soi-même',
    'Non',
    `Oui, par email (et SMS en formule Pro, ${SMS_QUOTA.pro}/mois)`,
  ],
  [
    'Plusieurs véhicules dans une même réservation',
    'Possible, mais recalculé à la main',
    'Non — un rendez-vous, un seul motif',
    'Oui, prix et durée propres à chaque véhicule',
  ],
]

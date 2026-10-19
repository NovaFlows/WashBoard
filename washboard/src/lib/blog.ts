// Index des articles du blog.
//
// Source unique pour la liste /blog, les liens internes et le sitemap : sans ça,
// publier un article obligerait à penser à trois endroits, et le sitemap finirait
// par mentir sur ce que le site contient réellement.

/**
 * Métier auquel l'article s'adresse. Sert à regrouper la liste /blog et à
 * adapter l'image de partage. `general` : conseils valables pour tous les
 * pros du nettoyage à domicile.
 */
export type Theme = 'auto' | 'vitres' | 'textiles' | 'menage' | 'piscine' | 'exterieur' | 'general'

export const THEME_LABEL: Record<Theme, string> = {
  auto: 'Lavage auto & detailing',
  vitres: 'Vitres',
  textiles: 'Canapés & textiles',
  menage: 'Ménage à domicile',
  piscine: 'Piscines',
  exterieur: 'Terrasses, façades & toitures',
  general: 'Tous métiers',
}

export type Article = {
  slug: string
  title: string
  description: string
  theme: Theme
  /** Format ISO, sert au sitemap et aux données structurées. */
  publishedAt: string
  updatedAt: string
  readingMinutes: number
}

// Source unique du domaine : defini dans plan.ts, re-exporte ici par commodite
// pour les pages du blog qui l utilisent deja sous ce nom.
export { SITE_URL_FALLBACK as SITE_URL } from '@/lib/plan'

export const ARTICLES: Article[] = [
  {
    slug: 'devenir-laveur-de-vitres-independant',
    title: 'Devenir laveur de vitres indépendant : tarifs, matériel, clients',
    description:
      'Le lavage de vitres est l’activité de nettoyage la plus simple à lancer et la plus récurrente : commerces, copropriétés, particuliers. Matériel (perche, raclette, eau pure), tarifs au m² ou à l’heure, et comment remplir un planning de passages réguliers.',
    theme: 'vitres',
    publishedAt: '2026-09-20',
    updatedAt: '2026-10-19',
    readingMinutes: 9,
  },
  {
    slug: 'nettoyage-canape-domicile-lancer-activite',
    title: 'Nettoyage de canapés et textiles à domicile : lancer et tarifer l’activité',
    description:
      'Canapés, matelas, tapis, sièges auto : une activité à forte marge qui se vend sur les photos avant/après. Matériel (injection-extraction), tarifs par pièce, temps par prestation et les erreurs qui abîment un tissu.',
    theme: 'textiles',
    publishedAt: '2026-09-20',
    updatedAt: '2026-10-19',
    readingMinutes: 8,
  },
  {
    slug: 'tarifs-menage-domicile-auto-entrepreneur',
    title: 'Ménage à domicile en indépendant : tarifs, planning et clients réguliers',
    description:
      'Combien facturer de l’heure, comment fixer ses minimums, construire un planning par secteur, et trouver des clients hebdomadaires qui restent.',
    theme: 'menage',
    publishedAt: '2026-09-20',
    updatedAt: '2026-10-19',
    readingMinutes: 9,
  },
  {
    slug: 'entretien-piscine-domicile-lancer-activite',
    title: 'Entretien de piscines à domicile : lancer une activité qui tourne toute l’année',
    description:
      'Un métier saisonnier qu’on peut lisser : contrats d’entretien mensuels, mise en route et hivernage, tournées par secteur. Ce qu’il faut savoir (chimie de l’eau, matériel), les tarifs pratiqués et comment vendre l’abonnement plutôt que l’intervention.',
    theme: 'piscine',
    publishedAt: '2026-09-20',
    updatedAt: '2026-10-19',
    readingMinutes: 9,
  },
  {
    slug: 'nettoyage-haute-pression-terrasses-facades-toitures',
    title: 'Nettoyage haute pression à domicile : terrasses, façades, toitures',
    description:
      'Le métier de laveur au sens strict : matériel (nettoyeur thermique, rotabuse, perche), tarifs au m² par surface, saisonnalité, ce qui se fait et ne se fait pas (toitures, bois, joints), et comment enchaîner les chantiers dans un même quartier.',
    theme: 'exterieur',
    publishedAt: '2026-09-20',
    updatedAt: '2026-10-19',
    readingMinutes: 9,
  },
  {
    slug: 'carte-de-fidelite-laveur-auto-mobile',
    theme: 'auto',
    title: 'Carte de fidélité pour laveur auto mobile : faire revenir ses clients',
    description:
      'Combien de tampons, quelle récompense, ce que ça coûte vraiment : le calcul d’une carte de fidélité pour un laveur auto à domicile, ce qui marche, ce qui ne marche pas, et comment la mettre en place sans carton à perdre.',
    publishedAt: '2026-10-18',
    updatedAt: '2026-10-18',
    readingMinutes: 8,
  },
  {
    slug: 'acompte-reservation-laveur-auto-mobile',
    theme: 'auto',
    title: 'Acompte à la réservation pour un laveur auto mobile : sans perdre de clients',
    description:
      'Rendez-vous manqués, créneaux bloqués pour rien : quand demander un acompte, combien, comment le faire payer (PayPal, Stripe, SumUp, Lydia, Wero, virement) et ce qui fait fuir les clients. Avec le calcul de ce que coûte un lapin.',
    publishedAt: '2026-10-18',
    updatedAt: '2026-10-18',
    readingMinutes: 8,
  },
  {
    slug: 'devis-lavage-auto-domicile',
    theme: 'auto',
    title: 'Faire un devis de lavage auto à domicile : quand, quoi écrire, modèle à recopier',
    description:
      'Quand un devis vaut la peine pour un laveur auto, ce qu’il doit dire pour éviter les malentendus, quelle durée de validité choisir, un modèle à recopier, et ce qui ne marche pas : le devis flou, le « à partir de », le prix changé après accord.',
    publishedAt: '2026-10-18',
    updatedAt: '2026-10-18',
    readingMinutes: 9,
  },
  {
    slug: 'lavage-flotte-vehicules-entreprise',
    theme: 'auto',
    title: 'Laver pour les entreprises : flottes, concessions, loueurs, auto-écoles — démarcher et se faire payer',
    description:
      'Comment approcher une concession, un loueur, une auto-école ou une flotte d’entreprise, les chiffrer par véhicule, cadrer la relation par écrit et se faire payer sans attendre. Avec ce qui ne marche pas.',
    publishedAt: '2026-10-18',
    updatedAt: '2026-10-19',
    readingMinutes: 10,
  },
  {
    slug: 'lavage-auto-sans-eau',
    theme: 'auto',
    title: 'Lavage auto sans eau : comment ça marche, pour qui, avec quoi',
    description:
      'Le lavage sans eau règle la question des eaux usées et permet d’intervenir partout. Principe, produits, limites (véhicule très sale, jantes), temps par voiture et argumentaire client.',
    publishedAt: '2026-09-20',
    updatedAt: '2026-10-19',
    readingMinutes: 8,
  },
  {
    slug: 'combien-gagne-un-laveur-auto-mobile',
    theme: 'auto',
    title: 'Combien gagne un laveur auto mobile ? Revenus réels et simulation',
    description:
      'Chiffre d’affaires, charges, cotisations, revenu net : une simulation honnête sur 3 profils (débutant, installé, avec clients pros) et les trois leviers qui font vraiment monter le revenu.',
    publishedAt: '2026-09-20',
    updatedAt: '2026-10-18',
    readingMinutes: 9,
  },
  {
    slug: 'fiche-google-laveur-auto-mobile',
    theme: 'auto',
    title: 'Fiche Google pour laveur auto mobile : la configurer pour recevoir des appels',
    description:
      'Zone de service au lieu d’une adresse, catégorie, photos, avis, réponses : le guide pas à pas pour qu’une fiche d’établissement Google amène des réservations de lavage à domicile.',
    publishedAt: '2026-09-20',
    updatedAt: '2026-10-18',
    readingMinutes: 8,
  },
  {
    slug: 'trouver-des-clients-laveur-auto-mobile',
    theme: 'auto',
    title: 'Comment trouver des clients quand on est laveur auto mobile',
    description:
      'Les canaux qui remplissent vraiment un agenda de lavage auto à domicile : fiche Google, avis clients, zones groupées, clients pros et relance des anciens clients. Sans budget publicitaire.',
    publishedAt: '2026-08-26',
    updatedAt: '2026-10-18',
    readingMinutes: 10,
  },
  {
    slug: 'tarifs-lavage-auto-domicile',
    theme: 'auto',
    title: 'Quels tarifs pratiquer en lavage auto à domicile',
    description:
      'Comment calculer un prix qui tient : temps réel par prestation, frais de déplacement, charges et cotisations. Avec une grille indicative et les erreurs qui plombent une marge.',
    publishedAt: '2026-08-26',
    updatedAt: '2026-10-19',
    readingMinutes: 9,
  },
  {
    slug: 'devenir-laveur-auto-mobile',
    theme: 'auto',
    title: 'Devenir laveur auto mobile : par où commencer',
    description:
      'Avec ou sans eau, matériel, budget de départ, premiers clients et erreurs coûteuses : les étapes concrètes pour lancer une activité de lavage auto à domicile sans se tromper.',
    publishedAt: '2026-08-26',
    updatedAt: '2026-10-19',
    readingMinutes: 11,
  },
  {
    slug: 'organiser-ses-tournees-lavage-auto',
    theme: 'auto',
    title: 'Organiser ses tournées pour laver plus de voitures par jour',
    description:
      'Les trajets entre deux rendez-vous mangent une à deux prestations par jour. Comment grouper ses créneaux par secteur, prévoir des durées réalistes et absorber les annulations.',
    publishedAt: '2026-08-26',
    updatedAt: '2026-10-18',
    readingMinutes: 8,
  },
]

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find(a => a.slug === slug)
}

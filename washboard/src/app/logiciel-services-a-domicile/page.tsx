import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/blog'
import { PLAN_CARDS, SMS_QUOTA } from '@/lib/plan'
import { metierPageForTheme } from '@/lib/metiers'
import type { Theme } from '@/lib/blog'
import MetierPageTemplate, { type MetierCovered, type MetierFeature, type MetierProblem } from '@/components/metiers/MetierPageTemplate'
import type { FaqItem } from '@/components/blog/Prose'

/** Chemin de la page métier pour ce thème, si elle existe déjà — sinon
 *  `undefined`, et la carte correspondante reste sans lien. */
function hrefMetier(theme: Theme): string | undefined {
  const page = metierPageForTheme(theme)
  return page ? `/${page.slug}` : undefined
}

// Page CATÉGORIE — pas une page métier (elle ne va donc pas dans
// `@/lib/metiers` → METIER_PAGES, qui piloterait sinon un lien à tort depuis
// les cartes "Pour qui ?" de la landing). C'est le hub de maillage inverse :
// elle pointe vers les pages métier déjà publiées, sans qu'aucune ne pointe
// vers elle en retour par ce mécanisme automatique.
//
// Recentrage 2026-09 : décision d'équipe de revenir sur le positionnement
// "tous les pros à domicile" pour se concentrer sur l'automobile — voir
// TODO.md. Cette page décrit exactement le positionnement abandonné
// (multi-métier) et est donc hors contexte avec le reste du site tel qu'il
// est aujourd'hui. Elle n'est pas supprimée : l'équipe n'exclut pas d'y
// revenir plus tard. En attendant, `robots: { index: false }` la retire des
// moteurs de recherche, et aucun lien du site ne pointe plus vers elle (les
// deux liens "Tous les métiers" du footer ont été retirés) — un visiteur ne
// peut plus tomber dessus par la navigation normale, elle reste seulement
// accessible par son adresse directe.
//
// Chaque affirmation ci-dessous est vérifiée dans le code avant d'être écrite,
// pas seulement plausible :
// - catégories et prestations totalement libres, un métier ou plusieurs dans
//   le même compte, prix et durée par prestation : src/components/dashboard/
//   admin/CategoriesManager.tsx, src/components/dashboard/admin/
//   PrestationsManager.tsx, src/lib/pricing.ts (vehiclePrice, offeredTypePrices)
// - réservation publique sans compte client : src/lib/faq.ts (FAQ_ITEMS,
//   "Mes clients doivent créer un compte ? Non.")
// - frais de déplacement par palier de trajet, depuis le point de départ ou
//   le dernier rendez-vous : src/lib/travelFee.ts
// - créneaux au temps de trajet réel, seuil de 15 min par défaut (5 à 30
//   configurable) : src/app/api/slots/smart/route.ts, src/lib/slots.ts,
//   src/components/dashboard/admin/IdentiteForm.tsx
// - multi-laveurs (plusieurs rendez-vous en même temps) réservé à la formule
//   Pro : src/lib/plan.ts (MIN_PLAN.multi_laveurs)
// - facture conforme (SIRET, TVA) : src/lib/plan.ts (PLAN_CARDS, "Facturation
//   conforme (SIRET, TVA)") ; envoi automatique par email au client
//   PROFESSIONNEL uniquement : src/lib/facture.ts (doitEnvoyerFactureAuClient)
//   — le client particulier la retrouve sur le même lien que sa confirmation
//   de réservation, qui sert d'abord le récapitulatif puis la facture une
//   fois émise : src/components/booking/StepConfirmation.tsx (lien
//   /api/bookings/[id]/pdf), src/app/api/bookings/[id]/pdf/route.ts
// - avis Google par email, par SMS en Pro (150/mois) : src/lib/plan.ts
//   (SMS_QUOTA)
// - relance automatique des clients qui ne reviennent pas, réservée à la
//   formule Pro : src/lib/relances.ts, src/lib/plan.ts (MIN_PLAN.followup)
// - prix des formules : src/lib/plan.ts (PLAN_CARDS), jamais recopiés
//
// Ce qui n'est PAS affirmé faute de preuve dans le code, à dessein : aucun
// devis, aucun rendez-vous récurrent dans l'agenda (`materializeRecurring.ts`
// ne matérialise que des dépenses, jamais des rendez-vous — src/lib/
// materializeRecurring.ts, src/app/api/expenses/route.ts), aucune plateforme
// de facturation électronique raccordée.

const title = 'Logiciel pour prestataires de services à domicile | WashBoard'
const description =
  "Le logiciel pour les prestataires de services à domicile qui interviennent chez leurs clients (lavage auto, ménage, vitres, canapés, piscines) : réservation en ligne, agenda, créneaux qui limitent les trajets, frais de déplacement automatiques et facturation conforme. Un mois offert, sans carte bancaire."
const url = `${SITE_URL}/logiciel-services-a-domicile`

export const metadata: Metadata = {
  title,
  description,
  // Recentrage 2026-09 (voir le commentaire de fichier plus haut) : la page
  // reste en ligne mais sort des moteurs de recherche. `follow` reste vrai,
  // les liens sortants vers les pages métier n'ont pas à être pénalisés.
  robots: { index: false, follow: true },
  alternates: { canonical: url },
  openGraph: {
    type: 'website',
    url,
    title,
    description,
  },
  twitter: { card: 'summary_large_image', title, description },
}

const problemes: MetierProblem[] = [
  {
    titre: 'Le trajet fait partie du métier, pas un imprévu',
    desc: 'Chaque prestation dépend d’une adresse différente : le temps perdu entre deux rendez-vous n’a rien d’anecdotique, et rien de tout ça ne se voit sur un agenda pensé pour un lieu fixe.',
  },
  {
    titre: 'Le prix ne s’affiche pas en vitrine',
    desc: 'Type de prestation, taille du chantier, distance à parcourir : le prix d’une intervention à domicile dépend de plusieurs facteurs à la fois, jamais d’un tarif unique valable partout.',
  },
  {
    titre: 'Chaque métier a ses propres prestations',
    desc: 'Lavage auto, ménage, vitres, canapés, piscines : chaque activité a ses catégories, ses options et ses durées. Un simple outil de prise de rendez-vous générique ne les distingue pas.',
  },
]

const fonctionnalites: MetierFeature[] = [
  {
    titre: 'Une page de réservation, pour n’importe quelle prestation à domicile',
    desc: 'Tu crées tes propres catégories et prestations, avec leur prix et leur durée — lavage auto, ménage, vitres, canapés, piscines, ou un métier que tu inventes toi-même. Le client réserve directement sur ta page, sans compte, sans application.',
  },
  {
    titre: 'Des frais de déplacement automatiques',
    desc: 'Tu définis des paliers selon le temps de trajet ; WashBoard calcule la distance réelle (Google Maps) depuis ton point de départ, ou depuis ton rendez-vous précédent si tu enchaînes plusieurs adresses, et applique le bon palier sans que tu aies à y penser.',
  },
  {
    titre: 'Des créneaux qui limitent la route entre deux adresses',
    desc: 'Quand un client saisit son adresse, WashBoard compare le temps de trajet réel à tes rendez-vous déjà prévus ce jour-là et met en avant les horaires proches de l’un d’eux, avec une remise si tu en as réglé une — le seuil se règle dans tes paramètres, un quart d’heure par défaut. Même sans remise, WashBoard ne propose jamais un horaire que le trajet rendrait injoignable.',
  },
  {
    titre: 'Un agenda qui suit ton équipe',
    desc: 'Seul, tu vois tes disponibilités telles quelles. En formule Pro, tu indiques la taille de ton équipe et tes absences : WashBoard accepte autant de rendez-vous en même temps que tu as de personnes disponibles.',
  },
  {
    titre: 'Une facture conforme, sans y penser',
    desc: 'Chaque prestation terminée peut générer une facture avec les mentions obligatoires (SIRET, TVA) : elle part automatiquement par email à tes clients professionnels, et tes clients particuliers la retrouvent sur le même lien que leur confirmation de réservation.',
  },
  {
    titre: 'Des avis Google après chaque intervention',
    desc: (
      <>
        Une demande d&apos;avis part automatiquement par email dès qu&apos;un rendez-vous passe en
        « Terminé » — par SMS aussi en formule Pro ({SMS_QUOTA.pro} par mois). Ce sont ces avis qui
        remplissent ta fiche Google et ton agenda de la semaine suivante.
      </>
    ),
  },
]

// Chaque page métier publiée lie automatiquement une carte à sa page grâce à
// `metierPageForTheme` : le jour où une nouvelle page métier sort (vitres,
// ménage, piscine...), la carte correspondante devient un lien sans qu'il
// faille toucher cette page. Les descriptions sont écrites à la main, avec un
// angle différent de la landing : ici, ce que le logiciel fait pour ce
// métier — pas ce qu'est le métier.
const metiers: MetierCovered[] = [
  {
    titre: 'Lavage auto & detailing',
    desc: 'Un prix et une durée par prestation et par véhicule, des options qui suivent chaque voiture, un déplacement facturé automatiquement à chaque nouvelle adresse.',
    href: hrefMetier('auto'),
  },
  {
    titre: 'Canapés & textiles à domicile',
    desc: 'Plusieurs pièces dans une même réservation, chacune avec son propre prix et sa propre durée, et une fiche client qui sait depuis combien de temps un client n’est pas revenu.',
    href: hrefMetier('textiles'),
  },
  {
    titre: 'Ménage à domicile',
    desc: 'Chaque passage se réserve comme une prestation à part entière, avec son prix et sa durée. Un client qui revient chaque semaine reprend un créneau à chaque fois, comme n’importe quelle autre réservation.',
    href: hrefMetier('menage'),
  },
  {
    titre: 'Vitres',
    desc: 'Un prix par prestation, chez un particulier comme sur la vitrine d’un commerce, et un déplacement facturé automatiquement d’une adresse à l’autre.',
    href: hrefMetier('vitres'),
  },
  {
    titre: 'Piscines',
    desc: 'Mise en route, hivernage, remise en état : chaque intervention se réserve comme une prestation à part entière, avec son prix et sa durée propres.',
    href: hrefMetier('piscine'),
  },
]

// Dérivés de PLAN_CARDS, jamais recopiés : un prix qui change dans plan.ts
// se répercute ici sans qu'il faille penser à cette page.
const essentiel = PLAN_CARDS.find(c => c.key === 'essentiel')!
const pro = PLAN_CARDS.find(c => c.key === 'pro')!

const faqItems: FaqItem[] = [
  {
    question: 'Quels métiers de services à domicile WashBoard couvre-t-il ?',
    answer:
      'WashBoard sert les prestataires du nettoyage et de l’entretien qui interviennent chez leurs clients : lavage auto et detailing, nettoyage de canapés et textiles, ménage, vitres, entretien de piscines. Tu crées tes propres catégories et prestations, avec leur prix et leur durée : WashBoard n’impose aucun métier en particulier dans ce périmètre.',
  },
  {
    question: 'Comment sont calculés les frais de déplacement entre deux adresses ?',
    answer:
      'Tu configures des paliers de prix selon le temps de trajet. À chaque réservation, WashBoard calcule la distance réelle via Google Maps, depuis ton point de départ ou depuis ton rendez-vous précédent selon le mode choisi, et applique automatiquement le bon palier.',
  },
  {
    question: 'Les créneaux proposés tiennent-ils compte du temps de trajet réel ?',
    answer:
      'Oui. WashBoard compare l’adresse d’un client qui réserve au temps de trajet réel jusqu’à tes rendez-vous déjà prévus ce jour-là, et met en avant les horaires les plus proches — pas un simple découpage de quartier sur une carte. Le seuil se règle dans tes paramètres, 15 minutes par défaut, réglable de 5 à 30.',
  },
  {
    question: 'WashBoard gère-t-il les rendez-vous récurrents, comme un ménage chaque semaine ?',
    answer:
      'Non, pas aujourd’hui : aucun rendez-vous ne se répète automatiquement dans l’agenda. Un client qui revient chaque semaine ou chaque mois reprend un créneau à chaque fois, comme n’importe quelle autre réservation. WashBoard garde en revanche l’historique de chaque client, et une relance automatique peut repartir vers ceux qui ne reviennent pas, en formule Pro.',
  },
  {
    question: 'Puis-je facturer mes clients directement depuis WashBoard ?',
    answer:
      'Oui. Chaque prestation terminée peut générer une facture avec les mentions obligatoires (SIRET, TVA). Elle part automatiquement par email à tes clients professionnels ; tes clients particuliers la retrouvent sur le même lien que leur confirmation de réservation.',
  },
  {
    question: 'Je peux gérer plusieurs métiers dans le même compte ?',
    answer:
      'Oui. Beaucoup de prestataires combinent plusieurs activités — lavage auto et ménage, par exemple : tu crées une catégorie par activité, chacune avec ses propres prestations, dans le même agenda.',
  },
  {
    question: 'Combien coûte WashBoard pour une activité de services à domicile ?',
    answer:
      `${essentiel.price}€/mois en formule ${essentiel.name} (réservation, agenda, créneaux optimisés, frais de déplacement, CRM, facturation, avis Google par email) ou ${pro.price}€/mois en formule ${pro.name}, qui ajoute la comptabilité, les avis par SMS, les relances de suivi et le multi-laveurs. Un mois est offert à l’inscription, sans carte bancaire.`,
  },
]

export default function Page() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        mainEntity: faqItems.map(item => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: title.split(' | ')[0], item: url },
        ],
      },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <MetierPageTemplate
        eyebrow="Prestataires de services à domicile"
        h1="Le logiciel pour prestataires de services à domicile"
        intro="Tu ne reçois pas tes clients dans un local : tu vas chez eux, adresse après adresse, avec ton matériel dans le coffre. Ce fonctionnement change ce qu'un logiciel doit savoir faire — caler un prix sur un trajet, grouper tes rendez-vous par quartier, facturer depuis n'importe où. WashBoard est conçu pour cette réalité des prestataires de services à domicile, dans le nettoyage et l'entretien mobile : lavage auto, ménage, vitres, canapés, piscines."
        problemesTitre="Une activité mobile n'a pas les problèmes d'un commerce fixe"
        problemes={problemes}
        fonctionnalitesTitre="Fait pour les prestataires qui se déplacent, quel que soit leur métier"
        fonctionnalitesIntro="Les mêmes fonctionnalités que WashBoard propose à chaque métier qu'il sert, communes à toute activité qui se pratique chez le client plutôt que dans un local."
        fonctionnalites={fonctionnalites}
        metiers={metiers}
        faq={faqItems}
        ctaTitre="Tu interviens, WashBoard gère le reste."
        ctaTexte="Ta page de réservation en ligne en 10 minutes, et ton premier mois offert."
      />
    </>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_URL } from '@/lib/blog'
import { PLAN_CARDS, SMS_QUOTA } from '@/lib/plan'
import MetierPageTemplate, { type MetierFeature, type MetierProblem } from '@/components/metiers/MetierPageTemplate'
import type { FaqItem } from '@/components/blog/Prose'

// Page métier — voir `@/lib/metiers` (METIER_PAGES) pour le gabarit et le
// principe : contenu propre à un métier, aucune donnée de laveur, maillage
// automatique vers les articles du même thème (`textiles`, un seul à ce jour).
//
// Chaque affirmation ci-dessous est vérifiée dans le code avant d'être écrite,
// pas seulement plausible :
// - catégories et prestations libres, avec des « types » propres à chaque
//   catégorie (ex. une catégorie « Canapé » avec les types 2 places, 3 places,
//   d'angle) et un prix par type : src/components/dashboard/admin/
//   PrestationsManager.tsx (CategoryType, vehicle_price_overrides),
//   src/lib/pricing.ts (vehiclePrice). Le champ s'appelle « vehicle_types »
//   dans le code (hérité du lavage auto) mais son usage est générique — voir
//   le texte d'aide de CategoriesManager : « par exemple Voiture avec
//   Citadine, Berline, SUV ».
// - plusieurs pièces dans une même réservation, chacune avec son propre prix,
//   sa propre durée et ses propres options : src/components/booking/
//   StepService.tsx (« Ajoutez un ou plusieurs éléments, de types différents
//   si besoin »), src/lib/pricing.ts (dureeTotale, prixOptions, addons par
//   élément)
// - frais de déplacement par palier de trajet, depuis le point de départ ou
//   le dernier rendez-vous : src/lib/travelFee.ts
// - créneaux au temps de trajet réel, seuil de 15 min par défaut (5 à 60
//   configurable) : src/app/api/slots/smart/route.ts, src/lib/slots.ts —
//   mécanisme générique, pas propre au lavage auto
// - historique et ancienneté du dernier passage par client : src/lib/
//   clientProfile.ts (daysSinceLastVisit)
// - relance automatique par email/SMS, délai réglable (90 jours par défaut,
//   de 1 à 730) : src/lib/relances.ts, src/types/index.ts
//   (followup_delay_days), src/app/api/washer/route.ts (bornes), réservée à
//   la formule Pro : src/lib/plan.ts (MIN_PLAN.followup)
// - avis Google par email, par SMS en Pro (150/mois) : src/lib/plan.ts
//   (SMS_QUOTA), src/lib/email/index.ts (demande d'avis après « Terminé »)
// - multi-laveurs réservé à la formule Pro : src/lib/plan.ts (MIN_PLAN)
// - prix des formules : src/lib/plan.ts (PLAN_CARDS), jamais recopiés
//
// Ce qui n'est PAS affirmé faute de preuve dans le code : aucune fonction de
// photos avant/après, aucun blocage d'agenda lié au temps de séchage. Ce sont
// des réalités du métier, pas des fonctionnalités du produit.

const title = 'Logiciel de nettoyage de canapés à domicile | WashBoard'
const description =
  'Le logiciel pour le nettoyage de canapés et textiles à domicile : prix par matière et par pièce, plusieurs pièces en une réservation, frais de déplacement automatiques, agenda, facturation et relances clients. Un mois offert, sans carte bancaire.'
const url = `${SITE_URL}/logiciel-nettoyage-canape`

export const metadata: Metadata = {
  title,
  description,
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
    titre: 'La matière et le nombre de places changent tout',
    desc: 'Un canapé deux places en tissu et un canapé d’angle en cuir n’ont ni le même prix, ni la même durée sur place. Un tarif unique sous-facture les grandes pièces ou fait fuir les petits clients.',
  },
  {
    titre: 'Le séchage retarde le verdict, pas ton départ',
    desc: 'Tu quittes le domicile une fois la prestation terminée, mais ton client ne verra le résultat définitif — et ne pourra se rasseoir — que plusieurs heures plus tard. Ça s’annonce avant, pas en partant.',
  },
  {
    titre: 'Tu travailles dans son salon, pas sur un parking',
    desc: (
      <>
        Meubles à déplacer, sol à protéger, client présent pour montrer les taches : l&apos;intervention
        se cale sur son emploi du temps à lui — et rien ne revient de lui-même, voir notre article sur{' '}
        <Link href="/blog/nettoyage-canape-domicile-lancer-activite" className="font-semibold text-[#1651E8] dark:text-[#6A9FFF] hover:underline">
          lancer l&apos;activité
        </Link>.
      </>
    ),
  },
]

const fonctionnalites: MetierFeature[] = [
  {
    titre: 'Un prix et une durée par matière et par nombre de places',
    desc: 'Tu crées tes propres catégories et prestations — canapé deux places, trois places, d’angle, fauteuil, matelas — chacune avec son prix et sa durée, bloqués tels quels dans ton agenda. Tu peux aussi définir un tarif différent selon la matière proposée pour une même prestation (tissu, microfibre, cuir, alcantara), sans renégocier sur place.',
  },
  {
    titre: 'Plusieurs pièces dans une même réservation',
    desc: 'Un client qui fait venir le canapé et les fauteuils, ou le canapé et un matelas, réserve tout en une fois : chaque pièce garde son propre prix, sa propre durée et ses propres options, sans moyenne appliquée à toute la commande.',
  },
  {
    titre: 'Des frais de déplacement automatiques',
    desc: 'Tu définis des paliers selon le temps de trajet ; WashBoard calcule la distance réelle (Google Maps) depuis ton point de départ, ou depuis ton rendez-vous précédent si tu enchaînes plusieurs adresses, et applique le bon palier sans que tu aies à y penser.',
  },
  {
    titre: 'Des créneaux qui limitent la route',
    desc: 'Quand un client saisit son adresse, WashBoard compare le temps de trajet réel à tes rendez-vous déjà prévus ce jour-là et met en avant les horaires proches de l’un d’eux, avec une remise si tu en as réglé une — le seuil se règle dans tes paramètres, un quart d’heure par défaut. Même sans remise, WashBoard ne propose jamais un horaire que le trajet rendrait injoignable.',
  },
  {
    titre: 'Une fiche client qui sait qui relancer',
    desc: 'WashBoard garde l’historique de chaque client — quelle pièce, quelle date, quel montant — et calcule depuis combien de temps il n’est pas revenu. Un canapé ne se salit pas tous les mois : en formule Pro, une relance automatique part au bout du délai que tu choisis toi-même, 90 jours par défaut, réglable jusqu’à deux ans.',
  },
  {
    titre: 'Des avis Google après chaque intervention',
    desc: `Une demande d'avis part automatiquement par email dès qu'un rendez-vous passe en « Terminé » — par SMS aussi en formule Pro (${SMS_QUOTA.pro} par mois). Dans un métier qui se vend sur un résultat visible, ce sont ces avis qui remplissent une fiche Google.`,
  },
]

// Dérivés de PLAN_CARDS, jamais recopiés : un prix qui change dans plan.ts
// se répercute ici sans qu'il faille penser à cette page.
const essentiel = PLAN_CARDS.find(c => c.key === 'essentiel')!
const pro = PLAN_CARDS.find(c => c.key === 'pro')!

const faqItems: FaqItem[] = [
  {
    question: 'WashBoard permet-il de fixer un prix différent selon la matière ou le nombre de places ?',
    answer:
      'Oui. Tu définis un prix de base par prestation (canapé, fauteuil, matelas…), puis un supplément ou une remise pour chaque type que tu proposes au sein de cette prestation — matière, nombre de places, état. Le client voit le prix exact dès qu’il choisit, sans négociation sur place.',
  },
  {
    question: 'Un client peut-il réserver plusieurs pièces en une seule fois ?',
    answer:
      'Oui. Canapé et fauteuils, canapé et matelas : un client compose sa commande pièce par pièce, chacune avec son propre prix, sa propre durée et ses propres options. La durée bloquée dans ton agenda correspond exactement à ce qu’il a choisi.',
  },
  {
    question: 'Comment sont calculés les frais de déplacement ?',
    answer:
      'Tu configures des paliers de prix selon le temps de trajet. À chaque réservation, WashBoard calcule la distance réelle via Google Maps, depuis ton point de départ ou depuis ton rendez-vous précédent selon le mode choisi, et applique automatiquement le bon palier — utile dans ce métier où le déplacement peut peser lourd face au prix d’une seule pièce.',
  },
  {
    question: 'Les créneaux optimisés ont-ils un intérêt pour des interventions ponctuelles comme celles-ci ?',
    answer:
      'Oui. Même pour des rendez-vous espacés dans le temps, WashBoard évite de te proposer un horaire que le trajet rendrait injoignable si tu as un autre rendez-vous le même jour, et met en avant les horaires proches d’une intervention déjà prévue à proximité.',
  },
  {
    question: 'Comment WashBoard aide-t-il face à un client qui ne revient qu’une ou deux fois par an ?',
    answer:
      'WashBoard garde l’historique de chaque client et calcule depuis combien de temps il n’est pas revenu. En formule Pro, une relance automatique par email ou SMS part au bout du délai que tu règles toi-même — 90 jours par défaut, jusqu’à deux ans. C’est ce qui rappelle un client à qui personne ne pense de lui-même.',
  },
  {
    question: 'Combien coûte WashBoard pour un professionnel du nettoyage de canapés ?',
    answer:
      `${essentiel.price}€/mois en formule ${essentiel.name} (réservation, agenda, créneaux optimisés, frais de déplacement, CRM, facturation, avis Google par email) ou ${pro.price}€/mois en formule ${pro.name}, qui ajoute la comptabilité, les avis par SMS, les relances de suivi et le multi-laveurs. Un mois est offert à l’inscription, sans carte bancaire.`,
  },
  {
    question: 'C’est adapté si le nettoyage de canapés n’est qu’une partie de mon activité ?',
    answer:
      'Oui. Beaucoup de professionnels le combinent avec le lavage auto ou le ménage : tu crées une catégorie par activité, chacune avec ses propres prestations et son propre agenda partagé. Si tu embauches ou travailles en binôme, la formule Pro accepte plusieurs rendez-vous en même temps, selon la taille d’équipe que tu renseignes.',
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
        theme="textiles"
        eyebrow="Canapés, matelas & textiles à domicile"
        h1="Le logiciel de gestion pour le nettoyage de canapés à domicile"
        intro="Tu nettoies des canapés, fauteuils et matelas chez tes clients, pièce par pièce, prestation par prestation. WashBoard est pensé pour cette réalité : un prix et une durée par pièce et par matière, plusieurs pièces réservables en une fois, et une fiche client qui sait qui relancer quand rien ne revient tout seul."
        problemesTitre="Le nettoyage de canapés a ses propres contraintes"
        problemes={problemes}
        fonctionnalitesTitre="Fait pour le nettoyage de canapés, pas pour n'importe quel métier"
        fonctionnalitesIntro="Les mêmes fonctionnalités que WashBoard propose à tous ses métiers, réglées pour les contraintes du nettoyage de canapés et textiles à domicile."
        fonctionnalites={fonctionnalites}
        faq={faqItems}
        ctaTitre="Tu nettoies, WashBoard gère le reste."
        ctaTexte="Ta page de réservation en ligne en 10 minutes, et ton premier mois offert."
      />
    </>
  )
}

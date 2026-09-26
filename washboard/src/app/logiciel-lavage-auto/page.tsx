import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_URL } from '@/lib/blog'
import { PLAN_CARDS, SMS_QUOTA } from '@/lib/plan'
import MetierPageTemplate, { type MetierFeature, type MetierProblem } from '@/components/metiers/MetierPageTemplate'
import type { FaqItem } from '@/components/blog/Prose'

// Page métier — voir `@/lib/metiers` (METIER_PAGES) pour le gabarit et le
// principe : contenu propre à un métier, aucune donnée de laveur, maillage
// automatique vers les articles du même thème (`auto`).
//
// Chaque affirmation ci-dessous est vérifiée dans le code avant d'être écrite,
// pas seulement plausible :
// - prix et durée par prestation, sélection du véhicule par le client :
//   src/components/booking/StepService.tsx, src/lib/pricing.ts
// - options et durée par véhicule (pas par commande) : src/lib/pricing.ts
//   (optionsParVehicule, dureeTotale, prixOptions)
// - frais de déplacement par palier de trajet, depuis le point de départ ou
//   le dernier rendez-vous : src/lib/travelFee.ts
// - créneaux au temps de trajet réel, seuil de 15 min par défaut (5 à 60
//   configurable) : src/app/api/slots/smart/route.ts, src/lib/slots.ts,
//   src/components/dashboard/admin/IdentiteForm.tsx
// - multi-laveurs réservé à la formule Pro : src/lib/plan.ts (MIN_PLAN)
// - avis Google par email, par SMS en Pro (150/mois) : src/lib/plan.ts
//   (SMS_QUOTA), landing (FONCTIONNALITES)
// - prix des formules : src/lib/plan.ts (PLAN_CARDS), jamais recopiés

const title = 'Logiciel de gestion pour laveur auto mobile | WashBoard'
const description =
  'Le logiciel pour laveur auto mobile : prix et durée par prestation, frais de déplacement automatiques, créneaux au temps de trajet réel, agenda et facturation. Un mois offert, sans carte bancaire.'
const url = `${SITE_URL}/logiciel-lavage-auto`

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
    titre: 'Un prix, une durée : mais lesquels, pour quelle voiture ?',
    desc: 'Un lavage complet ne dure ni ne coûte la même chose sur une citadine et sur un utilitaire. Un tarif unique sous-facture les gros véhicules ou décourage les petits clients.',
  },
  {
    titre: 'Le trajet mange une prestation par jour',
    desc: (
      <>
        Un simple embouteillage entre deux adresses peut coûter une prestation entière sur la journée
        — voir notre article sur{' '}
        <Link href="/blog/organiser-ses-tournees-lavage-auto" className="font-semibold text-[#1651E8] dark:text-[#6A9FFF] hover:underline">
          l&apos;organisation des tournées
        </Link>.
      </>
    ),
  },
  {
    titre: 'Les prestations se vendent à la carte',
    desc: 'Extérieur seul, lavage complet, option cuir ou désodorisation intérieure : chaque client compose sa prestation, avec un prix et une durée qui changent en conséquence.',
  },
]

const fonctionnalites: MetierFeature[] = [
  {
    titre: 'Un prix et une durée par prestation, par véhicule',
    desc: 'Chaque prestation (extérieur, complet, intérieur…) a son propre prix et sa propre durée, bloqués tels quels dans ton agenda. Tu peux aussi définir un tarif différent selon le type de véhicule choisi par le client — citadine, berline, SUV, utilitaire — pour ne plus sous-facturer les plus grands.',
  },
  {
    titre: 'Des options par véhicule, pas par commande',
    desc: 'Un client qui réserve deux voitures peut ne demander une option (cuir, désodorisation…) que sur l’une des deux : son prix et la durée bloquée dans ton agenda suivent exactement ce qu’il a choisi, véhicule par véhicule.',
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
    titre: 'Un agenda qui suit ton équipe',
    desc: 'Seul, tu vois tes disponibilités telles quelles. En formule Pro, tu indiques la taille de ton équipe et tes absences : WashBoard accepte autant de rendez-vous en même temps que tu as de laveurs disponibles.',
  },
  {
    titre: 'Des avis Google après chaque lavage',
    desc: (
      <>
        Une demande d&apos;avis part automatiquement par email dès qu&apos;un rendez-vous passe en
        « Terminé » — par SMS aussi en formule Pro ({SMS_QUOTA.pro} par mois). Pour un laveur auto,
        ce sont ces avis qui remplissent une{' '}
        <Link href="/blog/fiche-google-laveur-auto-mobile" className="font-semibold text-[#1651E8] dark:text-[#6A9FFF] hover:underline">
          fiche Google
        </Link>{' '}
        et l&apos;agenda de la semaine suivante.
      </>
    ),
  },
]

// Dérivés de PLAN_CARDS, jamais recopiés : un prix qui change dans plan.ts
// se répercute ici sans qu'il faille penser à cette page.
const essentiel = PLAN_CARDS.find(c => c.key === 'essentiel')!
const pro = PLAN_CARDS.find(c => c.key === 'pro')!

const faqItems: FaqItem[] = [
  {
    question: 'WashBoard permet-il de fixer un prix différent selon le véhicule ?',
    answer:
      'Oui. Tu définis un prix de base par prestation, puis un supplément ou une remise pour chaque type de véhicule que tu proposes (citadine, berline, SUV, utilitaire…). Le client voit le prix exact dès qu’il sélectionne son véhicule, sans négociation sur place.',
  },
  {
    question: 'Comment sont calculés les frais de déplacement ?',
    answer:
      'Tu configures des paliers de prix selon le temps de trajet. À chaque réservation, WashBoard calcule la distance réelle via Google Maps, depuis ton point de départ ou depuis ton rendez-vous précédent selon le mode choisi, et applique automatiquement le bon palier.',
  },
  {
    question: 'Comment fonctionnent les créneaux optimisés pour un laveur auto ?',
    answer:
      'WashBoard compare l’adresse d’un client qui réserve au temps de trajet réel jusqu’à tes rendez-vous déjà prévus ce jour-là, et met en avant les horaires les plus proches — pas un découpage de quartier sur une carte. Le seuil se règle dans tes paramètres (15 minutes par défaut, réglable de 5 à 60), avec une remise optionnelle que tu définis toi-même.',
  },
  {
    question: 'Puis-je gérer plusieurs véhicules dans une même réservation ?',
    answer:
      'Oui. Un client peut réserver plusieurs véhicules en une fois, et choisir des options différentes pour chacun : le prix et la durée bloquée dans ton agenda suivent ce qui a été choisi véhicule par véhicule, pas une moyenne appliquée à toute la commande.',
  },
  {
    question: 'Combien coûte WashBoard pour un laveur auto mobile ?',
    answer:
      `${essentiel.price}€/mois en formule ${essentiel.name} (réservation, agenda, créneaux optimisés, frais de déplacement, CRM, facturation, avis Google par email) ou ${pro.price}€/mois en formule ${pro.name}, qui ajoute la comptabilité, les avis par SMS, les relances de suivi et le multi-laveurs. Un mois est offert à l’inscription, sans carte bancaire.`,
  },
  {
    question: 'Est-ce adapté si je travaille seul ?',
    answer:
      'Oui, la formule Essentiel est pensée pour un laveur seul. Si tu embauches ou travailles en binôme, la formule Pro accepte plusieurs rendez-vous en même temps, selon la taille d’équipe que tu renseignes.',
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
        theme="auto"
        eyebrow="Lavage auto & detailing mobile"
        h1="Le logiciel de gestion pour laveur auto mobile"
        intro="Tu laves des voitures chez tes clients, prestation par prestation, adresse par adresse. WashBoard est pensé pour cette réalité : un prix et une durée par prestation et par véhicule, des frais de déplacement calculés automatiquement, et un agenda qui évite les trajets inutiles entre deux rendez-vous."
        problemesTitre="Le lavage auto mobile a ses propres contraintes"
        problemes={problemes}
        fonctionnalitesTitre="Fait pour le lavage auto, pas pour n'importe quel métier"
        fonctionnalitesIntro="Les mêmes fonctionnalités que WashBoard propose à tous ses métiers, réglées pour les contraintes du lavage auto mobile."
        fonctionnalites={fonctionnalites}
        faq={faqItems}
        ctaTitre="Tu laves, WashBoard gère le reste."
        ctaTexte="Ta page de réservation en ligne en 10 minutes, et ton premier mois offert."
      />
    </>
  )
}

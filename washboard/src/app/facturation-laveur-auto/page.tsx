import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_URL } from '@/lib/blog'
import { requiredPlanLabel } from '@/lib/plan'
import { VALIDITE_DEVIS_JOURS } from '@/lib/documents'
import { resumeOffres } from '@/lib/resumeOffres'
import MetierPageTemplate, { type MetierFeature, type MetierProblem } from '@/components/metiers/MetierPageTemplate'
import type { FaqItem } from '@/components/blog/Prose'

// Page « fonctionnalité » : la facturation d'un laveur auto mobile. Requête
// distincte de /logiciel-lavage-auto (logiciel de gestion en général) et des
// articles du blog (aucun ne traite de la facture).
//
// Chaque affirmation est vérifiée dans le code :
// - statut (entrepreneur individuel / société), SIRET contrôlé (clé de Luhn),
//   adresse, régime de TVA (franchise ou assujetti, taux 20 / 10 / 5,5 %),
//   numéro de TVA, mentions de société (forme, capital, RCS) : src/lib/facture.ts
// - numérotation continue attribuée en base (F-00001), reprise possible d'une
//   numérotation existante, jamais en arrière : src/lib/guide.ts (facture-numero)
// - facture créée au passage en « Terminé » ; sans informations complètes, un
//   simple récapitulatif et le bouton « Émettre la facture » : src/lib/guide.ts
// - envoi par email au client PROFESSIONNEL seulement ; un particulier la
//   retrouve par son lien de confirmation : src/lib/facture.ts
//   (doitEnvoyerFactureAuClient), src/app/api/bookings/[id]/pdf/route.ts
// - frais de déplacement en ligne séparée, quantité = nombre de véhicules :
//   src/lib/facture.ts
// - import d'anciennes factures (PDF/JPG/PNG ou ZIP, 200 au plus) :
//   src/lib/importFactures.ts, src/lib/guide.ts
// - offre : MIN_PLAN.facturation (src/lib/plan.ts), nom dérivé
// - facturation électronique 2027 : même position que src/lib/faq.ts, pas de
//   raccordement à une plateforme agréée aujourd'hui, aucune date promise
//
// - devis écrit à la main, sans rendez-vous : émis numéroté, validité obligatoire
//   (30 jours proposés, modifiable), envoi par email avec PDF joint ou WhatsApp,
//   réponse du client notée à la main (accepté / refusé), « Bon pour accord » sur le PDF,
//   transformation en facture d'un tap : src/lib/documents.ts, src/app/api/documents/route.ts,
//   src/app/api/documents/[id]/{route,envoyer,facturer}/route.ts. Même offre que la facture
//   (DocumentsV2.tsx : peut('facturation')). L'écran de création est dans la version mobile
//   (et le site en grand écran avec la bêta), pas sur le site classique : Documents.tsx.
//
// Non affirmé : aucune plateforme agréée raccordée, pas de signature électronique du client.

const title = 'Logiciel de facturation pour laveur auto mobile | WashBoard'
const description =
  'Facture conforme pour laveur auto mobile : SIRET, TVA ou franchise, numérotation continue, créée à la fin de chaque rendez-vous et envoyée à tes clients pros. Un mois offert, sans carte bancaire.'
const url = `${SITE_URL}/facturation-laveur-auto`

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: url },
  openGraph: { type: 'website', url, title, description },
  twitter: { card: 'summary_large_image', title, description },
}

const problemes: MetierProblem[] = [
  {
    titre: 'Une facture, ce n’est pas un reçu',
    desc: 'Un client professionnel (garage, société, flotte) réclame une vraie facture : nom légal, SIRET, adresse, TVA ou mention de franchise, numéro. Les refaire à la main entre deux voitures, c’est du temps non facturé.',
  },
  {
    titre: 'La numérotation ne pardonne pas les trous',
    desc: 'Les numéros doivent se suivre sans trou ni doublon. Sur un tableur ou un modèle copié-collé, une erreur de numéro se découvre au pire moment.',
  },
  {
    titre: 'Le déplacement et les véhicules se perdent en route',
    desc: 'Deux voitures, une option sur l’une, un trajet de trente minutes : reconstituer le détail à la main après coup, c’est refaire le calcul que le client a déjà accepté en réservant.',
  },
]

const fonctionnalites: MetierFeature[] = [
  {
    titre: 'Une facture créée toute seule à « Terminé »',
    desc: `En formule ${requiredPlanLabel('facturation')}, la facture est créée automatiquement quand tu marques le rendez-vous « Terminé », à partir de ce que le client a réservé : prestation, options, véhicules, frais de déplacement en ligne séparée.`,
  },
  {
    titre: 'Tes mentions, saisies une seule fois',
    desc: 'Tu indiques ton statut (entrepreneur individuel ou micro-entreprise, ou société), ton nom légal, ton SIRET (contrôlé à la saisie), ton adresse et ton régime de TVA : franchise, ou assujetti avec un taux de 20 %, 10 % ou 5,5 %. Une société ajoute sa forme juridique, son capital et son RCS. Tant qu’il manque quelque chose, un bandeau te dit précisément quoi.',
  },
  {
    titre: 'Une numérotation continue',
    desc: 'Les factures se suivent (F-00001, F-00002…) sans trou ni doublon. Si tu facturais déjà avant, tu peux reprendre ta propre numérotation en indiquant le numéro de la prochaine facture ; il ne peut jamais reculer.',
  },
  {
    titre: 'Des devis, sans rendez-vous derrière',
    desc: (
      <>
        Un travail à chiffrer avant de dire oui (remise en état, tapis, flotte d’une entreprise) ?
        Tu écris le devis depuis ton téléphone : client, lignes, total et date jusqu’à laquelle ton
        prix reste valable ({VALIDITE_DEVIS_JOURS} jours proposés). Il part par email avec son PDF, ou par WhatsApp. Tu
        notes la réponse du client, accepté ou refusé, et un devis accepté se transforme en facture
        d’un tap, sans rien retaper. Les étapes complètes sont dans{' '}
        <Link href="/blog/devis-lavage-auto-domicile" className="font-semibold text-[#1651E8] dark:text-[#6A9FFF] hover:underline">
          notre guide du devis de lavage auto
        </Link>.
      </>
    ),
  },
  {
    titre: 'Envoyée à tes clients pros, retrouvable par les particuliers',
    desc: 'Quand le client a réservé en tant que professionnel, sa facture lui part par email à la clôture du rendez-vous. Un particulier ne reçoit pas d’envoi séparé : sa facture existe dans ton espace, et il la retrouve depuis le lien de sa confirmation de réservation.',
  },
  {
    titre: 'Tes anciennes factures au même endroit',
    desc: 'Tu peux importer tes factures de vente déjà émises (PDF, JPG ou PNG, ou un ZIP jusqu’à 200 fichiers). Elles gardent leur numéro d’origine et ne prennent pas de numéro WashBoard.',
  },
  {
    titre: 'Et la comptabilité derrière',
    desc: (
      <>
        Les prestations terminées alimentent tes recettes, et tu y ajoutes tes dépenses (carburant,
        produits, matériel) : le résultat se lit mois par mois, dans la même formule. Voir le{' '}
        <Link href="/logiciel-lavage-auto" className="font-semibold text-[#1651E8] dark:text-[#6A9FFF] hover:underline">
          logiciel complet pour laveur auto mobile
        </Link>.
      </>
    ),
  },
]

const faqItems: FaqItem[] = [
  {
    question: 'Quand la facture est-elle créée ?',
    answer:
      'Au moment où tu marques le rendez-vous « Terminé ». Si tes informations de facturation sont incomplètes, le rendez-vous passe quand même en terminé mais le client reçoit un simple récapitulatif ; une fois les informations complétées, tu émets la facture manquante depuis la fiche du rendez-vous.',
  },
  {
    question: 'Mon client reçoit-il sa facture par email ?',
    answer:
      'Si le client a réservé en tant que professionnel, oui, dès la clôture du rendez-vous. Un particulier ne reçoit pas d’envoi séparé : tu retrouves sa facture dans ton espace, et lui y accède depuis son lien de confirmation.',
  },
  {
    question: 'Je suis en franchise de TVA : est-ce géré ?',
    answer:
      'Oui. Tu choisis ton régime : franchise, ou assujetti à la TVA avec un taux de 20 %, 10 % ou 5,5 %. Si tu factures la TVA, ton numéro de TVA intracommunautaire est demandé.',
  },
  {
    question: 'Peut-on reprendre ma numérotation actuelle ?',
    answer:
      'Oui : tu renseignes le numéro de ta prochaine facture avant d’émettre la première. Ce numéro ne peut pas reculer, WashBoard refuse une valeur inférieure à une facture déjà émise.',
  },
  {
    question: 'Puis-je faire un devis, et le transformer en facture ?',
    answer:
      `Oui, dès la formule ${requiredPlanLabel('facturation')}. Tu écris le devis depuis la version mobile de WashBoard, sans rendez-vous derrière, avec une date de validité (${VALIDITE_DEVIS_JOURS} jours proposés, modifiable). Il part par email avec le PDF en pièce jointe, ou par WhatsApp. Le client le retourne daté et signé avec la mention « Bon pour accord » ; tu notes sa réponse, accepté ou refusé. Un devis accepté se transforme en facture d’un tap : le client, les lignes et la remise sont repris tels quels, et la facture prend le numéro suivant de ta suite. Il n’y a pas de signature électronique dans WashBoard : la réponse est notée par toi.`,
  },
  {
    question: 'Et la facturation électronique obligatoire en 2027 ?',
    answer:
      'À partir du 1er septembre 2027, les factures destinées aux entreprises devront circuler dans un format électronique via une plateforme agréée. Tes factures WashBoard ont déjà les mentions obligatoires, mais WashBoard n’est pas raccordé à une plateforme agréée aujourd’hui et ne s’engage sur aucune date. Si tu ne factures que des particuliers, c’est l’e-reporting qui te concerne, et WashBoard n’y est pas non plus raccordé.',
  },
  {
    question: 'Combien coûte WashBoard avec la facturation ?',
    answer: resumeOffres(),
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
        eyebrow="Facturation pour le lavage auto mobile"
        h1="Le logiciel de facturation pour laveur auto mobile"
        intro="Tu laves, tu marques le rendez-vous terminé, la facture se crée : avec ton SIRET, ton régime de TVA, un numéro qui suit le précédent, et le détail exact de ce que le client a réservé."
        problemesTitre="Facturer à la main, c’est le travail qu’on repousse"
        problemes={problemes}
        fonctionnalitesTitre="Une facture conforme, sans y repenser"
        fonctionnalitesIntro="Ce que WashBoard fait de la facture, de la saisie de tes mentions à l’envoi."
        fonctionnalites={fonctionnalites}
        faq={faqItems}
        ctaTitre="Tu laves, la facture suit."
        ctaTexte="Ta page de réservation en ligne en 10 minutes, et ton premier mois offert."
      />
    </>
  )
}

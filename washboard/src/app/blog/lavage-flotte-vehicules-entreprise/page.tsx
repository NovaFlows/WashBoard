import type { Metadata } from 'next'
import { getArticle, SITE_URL } from '@/lib/blog'
import { lienPageMetier } from '@/lib/metiers'
import { PLAN_CARDS, requiredPlan, requiredPlanLabel } from '@/lib/plan'
import { tarifOffre } from '@/lib/resumeOffres'
import { H2, P, UL, A, Table, Summary, Faq, ArticleHeader, Cta, AlsoRead, ArticleJsonLd, type FaqItem } from '@/components/blog/Prose'

const article = getArticle('lavage-flotte-vehicules-entreprise')!
const url = `${SITE_URL}/blog/${article.slug}`

// Offre qui ouvre la facturation : nom et tarif lus dans plan.ts, jamais recopiés.
const offreFacturation = PLAN_CARDS.find(c => c.key === requiredPlan('facturation'))!

// Ce que dit l'article du produit est vérifié dans le code :
// - client professionnel : raison sociale, SIRET (14 chiffres) et adresse de facturation saisis à
//   la réservation : components/booking/ContactDetails.tsx
// - plusieurs véhicules dans une réservation, quantité = nombre de véhicules, déplacement en
//   ligne séparée : lib/facture.ts (lignesFacture)
// - facture créée à « Terminé », envoyée par email au client professionnel seulement :
//   lib/facture.ts (doitEnvoyerFactureAuClient)
// - PDF : SIREN du client, nature « Prestation de services », pénalités de retard et indemnité
//   de 40 € pour un client professionnel, « paiement comptant le jour de la prestation » :
//   components/pdf/FacturePDF.tsx
// - TVA : franchise ou 20 / 10 / 5,5 %, numéro de TVA demandé si assujetti : lib/facture.ts
// - fiche entreprise (sites, contacts, délai de paiement convenu, devis en attente, factures
//   impayées), version mobile : components/dashboard/FicheEntrepriseV2.tsx
// - une facture par rendez-vous ; pas de facture mensuelle regroupée (aucune trace dans le code)

export const metadata: Metadata = {
  title: `${article.title} | WashBoard`,
  description: article.description,
  alternates: { canonical: url },
  openGraph: {
    type: 'article',
    url,
    title: article.title,
    description: article.description,
    publishedTime: article.publishedAt,
    modifiedTime: article.updatedAt,
    authors: ['WashBoard'],
    section: 'Clients professionnels',
  },
  twitter: { card: 'summary_large_image', title: article.title, description: article.description },
}

const faq: FaqItem[] = [
  {
    question: 'Comment démarcher une concession, un loueur ou une auto-école quand on est laveur auto mobile ?',
    answer:
      'Allez sur place, aux heures creuses, et demandez la personne qui s’occupe des véhicules : responsable d’agence, chef d’atelier, gérant. Proposez de laver gratuitement ou à prix réduit un seul véhicule, laissez un devis écrit avec un tarif par véhicule et par passage, et rappelez quelques jours plus tard. Le travail se voit immédiatement : c’est votre meilleur argument.',
  },
  {
    question: 'Faut-il un contrat pour laver les véhicules d’une entreprise ?',
    answer:
      'Un écrit vous protège des deux côtés dès que le travail est récurrent : périmètre, fréquence, prix hors taxes, délai de paiement, durée et préavis. Un devis accepté suffit souvent.',
  },
  {
    question: 'Mon client professionnel reçoit-il sa facture par email avec WashBoard ?',
    answer:
      'Oui, s’il a réservé en tant que professionnel : sa facture lui part par email à la clôture du rendez-vous, avec sa raison sociale et son SIREN. WashBoard émet une facture par rendez-vous ; il n’y a pas de facture mensuelle regroupée à ce jour.',
  },
]

export default function Page() {
  return (
    <>
      <ArticleJsonLd article={article} siteUrl={SITE_URL} faq={faq} />
      <article>
        <ArticleHeader
          article={article}
          intro="Un particulier lave sa voiture quelques fois par an. Une concession, un loueur, une auto-école ou une société avec des véhicules de service, c’est plusieurs véhicules au même endroit, un besoin qui revient et quelqu’un qui paie sur facture. Comment aller les chercher, quoi leur proposer, et comment facturer proprement."
        />

        <Summary
          items={[
            'Le client professionnel vaut le détour pour une raison simple : plusieurs véhicules au même endroit, donc moins de trajet par véhicule lavé.',
            'Chaque cible achète pour une raison différente : l’image (auto-école), la rotation (loueur), la vente (concession), l’utilité (flotte de service). Parlez de la sienne.',
            'Chiffrez par véhicule et par passage, hors taxes, avec une remise de volume que vous avez calculée, pas devinée.',
            'Mettez-vous d’accord sur le délai de paiement avant le premier lavage, pas à la première facture.',
            'Ce qui ne marche pas : brader l’entrée, dépendre d’un seul client, travailler sans écrit et sans assurance adaptée.',
          ]}
        />

        <P>
          Les clients professionnels sont déjà évoqués dans{' '}
          <A href="/blog/trouver-des-clients-laveur-auto-mobile">comment trouver des clients quand on est laveur auto mobile</A>.
          Cet article va plus loin sur ce qui change vraiment avec eux : la façon de les approcher, de
          les chiffrer, de se faire payer et de ne pas se retrouver dépendant d&apos;un seul.
        </P>

        <H2>Qui démarcher, et pourquoi chacun achète</H2>
        <P>
          Ne présentez pas la même offre à tous. Chaque cible a une raison différente de payer un
          lavage, et c&apos;est cette raison qu&apos;il faut dire en premier. Le tableau suivant est
          un raisonnement de bon sens, pas une enquête : validez-le en posant la question.
        </P>
        <Table
          head={['Cible', 'Pourquoi elle achète', 'Qui décide, à vérifier sur place']}
          rows={[
            ['Concession, vendeur de véhicules d’occasion', 'Une voiture propre se montre et se vend mieux ; préparation avant livraison', 'Chef d’atelier, responsable de la préparation ou directeur'],
            ['Loueur de voitures ou d’utilitaires', 'Remettre rapidement en service des véhicules qui reviennent sales', 'Responsable d’agence'],
            ['Auto-école', 'Des véhicules vus par chaque élève, utilisés toute la journée', 'Gérant'],
            ['Entreprise avec flotte (artisans, commerciaux, services à domicile)', 'L’image de l’entreprise chez ses propres clients', 'Dirigeant, office manager ou responsable de flotte'],
            ['Garage ou carrossier', 'Rendre le véhicule propre au client qui le récupère', 'Gérant ou chef d’atelier'],
          ]}
        />

        <H2>Les démarcher : l&apos;approche qui évite le mur du standard</H2>
        <P>
          Un laveur mobile a un avantage sur n&apos;importe quel prospect : il se présente avec la
          preuve dans le coffre. Déplacez-vous plutôt que d&apos;envoyer un mail qui ne sera pas lu :
        </P>
        <UL>
          <li><strong>Passez aux heures creuses</strong>{' '}(pas à l&apos;ouverture, pas à la fermeture) et demandez la personne qui s&apos;occupe des véhicules, pas « le patron ».</li>
          <li><strong>Proposez un essai sur un seul véhicule</strong>{' '}à prix réduit ou offert, devant eux si possible. Un avant/après vu de ses yeux convainc mieux que dix photos.</li>
          <li><strong>Laissez un devis écrit</strong>{' '}avec un tarif par véhicule et par passage (voir{' '}<A href="/blog/devis-lavage-auto-domicile">faire un devis de lavage auto à domicile</A>). Un prospect qui hésite doit pouvoir le transmettre à celui qui décide.</li>
          <li><strong>Relancez une fois</strong>{' '}quelques jours plus tard, avec une question précise (« combien de véhicules ? à quelle fréquence ? ») plutôt qu&apos;un « avez-vous réfléchi ? ».</li>
        </UL>
        <P>
          Sur un site d&apos;entreprise, une question pratique décide de tout : où l&apos;eau peut-elle
          s&apos;écouler, et y a-t-il un point d&apos;eau et d&apos;électricité ? Demandez-le avant de
          chiffrer. Si la réponse est « nulle part », le{' '}
          <A href="/blog/lavage-auto-sans-eau">lavage sans eau</A>{' '}règle le sujet.
        </P>

        <H2>Chiffrer : par véhicule, par passage, hors taxes</H2>
        <P>
          Un professionnel raisonne souvent hors taxes et par véhicule. Donnez-lui une grille
          qu&apos;il peut relire en dix secondes : un prix HT par véhicule et par passage, une remise de
          volume écrite, et les frais de déplacement soit inclus, soit sur une ligne à part.
        </P>
        <P>
          Calculez votre remise au lieu de l&apos;accorder à l&apos;oreille. Exemple chiffré, prix et
          durées indicatifs, à remplacer par les vôtres : un lavage extérieur à 40 € pour un particulier,
          dans la fourchette des{' '}
          <A href="/blog/tarifs-lavage-auto-domicile">tarifs du lavage auto à domicile</A>, une
          quarantaine de minutes de travail. Pour six véhicules au même endroit, il n&apos;y a plus de
          trajet entre deux prestations : une remise de 10 % ramène chaque véhicule à 36 €, soit 216 €
          pour environ quatre heures de lavage, un peu plus de 50 € de l&apos;heure avant charges.
          Si ce chiffre est supérieur à ce que vous gagnez chez les particuliers trajets compris,
          la remise est tenable. S&apos;il est inférieur, ce n&apos;est pas un tarif de volume, c&apos;est
          une perte.
        </P>

        <H2>Un contrat, ou au moins un écrit</H2>
        <P>
          Dès que le travail est récurrent, ne vous passez pas d&apos;un écrit (un devis accepté suffit souvent, un contrat
          court mieux encore). Il doit dire :
        </P>
        <UL>
          <li>le périmètre : quels véhicules, à quelle adresse, à quel emplacement ;</li>
          <li>les prestations incluses et la fréquence (toutes les semaines, deux fois par mois) ;</li>
          <li>le prix hors taxes par véhicule et par passage, et ce qui est facturé en plus ;</li>
          <li>l&apos;accès à l&apos;eau, à l&apos;électricité, et les créneaux autorisés ;</li>
          <li>l&apos;annulation et les intempéries : qui décale, qui facture ;</li>
          <li>le délai de paiement ;</li>
          <li>la durée et le préavis de résiliation, dans les deux sens ;</li>
          <li>la responsabilité en cas de dommage, et l&apos;assurance qui la couvre (voir <A href="/blog/assurance-laveur-auto-mobile">quelle assurance pour un laveur auto mobile</A>).</li>
        </UL>

        <H2>Se faire payer : ce qui change avec une entreprise</H2>
        <P>
          Une entreprise ne paie pas en main propre à la fin du lavage : elle paie sur facture, souvent
          plus tard, et la range dans sa comptabilité. Trois habitudes évitent d&apos;attendre :
        </P>
        <UL>
          <li><strong>Convenez du délai à l&apos;avance</strong>{' '}et écrivez-le sur le devis, plutôt que de le découvrir à la première relance.</li>
          <li><strong>Facturez le jour même</strong>, avec sa raison sociale et le détail par véhicule : une facture incomplète revient, et repart en bas de la pile.</li>
          <li><strong>Demandez à qui l&apos;envoyer</strong>{' '}: le responsable d&apos;agence qui vous a fait venir n&apos;est pas toujours celui qui paie.</li>
        </UL>

        <H2>Ce qui ne marche pas</H2>
        <UL>
          <li>
            <strong>Brader l&apos;entrée.</strong>{' '}Un premier véhicule offert ouvre la porte ; un tarif
            de volume trop bas la referme sur votre marge. L&apos;essai sert à convaincre, il ne fixe
            pas la grille.
          </li>
          <li>
            <strong>Dépendre d&apos;un seul client.</strong>{' '}Un loueur ou une concession qui représente
            la moitié de votre chiffre d&apos;affaires peut vous quitter du jour au lendemain, ou
            retarder ses paiements, et vous n&apos;avez plus d&apos;agenda de remplacement. Gardez
            des particuliers dans votre planning.
          </li>
          <li>
            <strong>Accepter un délai de paiement sans l&apos;avoir calculé.</strong>{' '}À 60 jours, vous
            avancez deux mois de carburant, de produits et de cotisations. Ne le découvrez pas en
            fin de mois.
          </li>
          <li>
            <strong>Travailler sans écrit.</strong>{' '}« On s&apos;arrange » tient jusqu&apos;au premier
            dommage, au premier retard de paiement, ou au changement de responsable d&apos;agence.
          </li>
          <li>
            <strong>Facturer tard.</strong>{' '}Une facture envoyée un mois plus tard est payée un mois
            plus tard. Émettez-la le jour de la prestation.
          </li>
          <li>
            <strong>Couvrir tout seul une flotte trop grande.</strong>{' '}Au-delà de ce que vous pouvez
            laver en une demi-journée, vous manquez de temps pour vos autres clients. Annoncez dès le
            début le nombre de véhicules que vous prenez.
          </li>
        </UL>

        <H2>Ce que fait WashBoard pour un client professionnel</H2>
        <P>
          Un client qui réserve en tant que professionnel saisit sa raison sociale, son SIRET et son
          adresse de facturation. S&apos;il réserve plusieurs véhicules, la facture reprend chaque
          véhicule, avec le déplacement sur une ligne séparée. Elle est créée quand vous marquez le
          rendez-vous « Terminé » et lui part par email : son SIREN, extrait du SIRET qu&apos;il a saisi,
          y figure, avec la nature « prestation de services », le taux des pénalités de retard et
          l&apos;indemnité de 40 €. Côté vous, votre SIRET est contrôlé à la saisie, et la TVA est soit la franchise, soit un
          taux de 20 %, 10 % ou 5,5 % avec votre numéro de TVA.
        </P>
        <P>
          Trois limites à connaître. WashBoard émet une facture par rendez-vous : il n&apos;y a pas de
          facture mensuelle regroupée. La facture générée indique un paiement comptant le jour de la
          prestation : un délai de 30 jours négocié se retrouve dans votre contrat ou votre devis, pas
          sur le PDF. Enfin, WashBoard n&apos;est pas raccordé à une plateforme agréée de facturation
          électronique aujourd&apos;hui : voir la{' '}
          <A href="/facturation-laveur-auto">page facturation</A>{' '}pour où nous en sommes.
        </P>

        <Faq items={faq} />

        <Cta
          title="Des clients pros, des factures qui tiennent"
          secondary={lienPageMetier(article.theme)}
        >
          Avec WashBoard, en formule {requiredPlanLabel('facturation')} ({tarifOffre(offreFacturation)}),
          un client professionnel réserve plusieurs véhicules d&apos;un coup, sa facture est créée à la fin
          du rendez-vous avec son SIREN, et elle lui part par email. Dans la version mobile, la fiche
          entreprise regroupe ses contacts, ses sites, ses véhicules, ses devis en attente et le délai
          de paiement convenu, et vous écrivez un devis chez lui, sur place. Un tampon par véhicule est
          possible sur la carte de fidélité, pour que la fidélité d&apos;une flotte avance au rythme de son
          volume.
        </Cta>

        <AlsoRead
          items={[
            { href: '/blog/trouver-des-clients-laveur-auto-mobile', label: 'Comment trouver des clients quand on est laveur auto mobile' },
            { href: '/blog/devis-lavage-auto-domicile', label: 'Faire un devis de lavage auto à domicile : quand, quoi écrire, modèle à recopier' },
            { href: '/blog/carte-de-fidelite-laveur-auto-mobile', label: 'Carte de fidélité pour laveur auto mobile : faire revenir ses clients' },
            { href: '/blog/organiser-ses-tournees-lavage-auto', label: 'Organiser ses tournées pour laver plus de voitures par jour' },
          ]}
        />
      </article>
    </>
  )
}

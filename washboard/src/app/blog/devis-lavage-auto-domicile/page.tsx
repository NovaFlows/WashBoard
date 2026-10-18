import type { Metadata } from 'next'
import { getArticle, SITE_URL } from '@/lib/blog'
import { lienPageMetier } from '@/lib/metiers'
import { PLAN_CARDS, requiredPlan, requiredPlanLabel } from '@/lib/plan'
import { VALIDITE_DEVIS_JOURS } from '@/lib/documents'
import { tarifOffre } from '@/lib/resumeOffres'
import { H2, P, UL, A, Callout, Table, Summary, Faq, ArticleHeader, Cta, AlsoRead, ArticleJsonLd, type FaqItem } from '@/components/blog/Prose'

const article = getArticle('devis-lavage-auto-domicile')!
const url = `${SITE_URL}/blog/${article.slug}`

// Offre qui ouvre les devis (même palier que la facturation) : nom et tarif lus dans
// plan.ts, jamais recopiés.
const offreDevis = PLAN_CARDS.find(c => c.key === requiredPlan('facturation'))!

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
    section: 'Facturer',
  },
  twitter: { card: 'summary_large_image', title: article.title, description: article.description },
}

const faq: FaqItem[] = [
  {
    question: 'Un devis est-il obligatoire pour laver une voiture à domicile ?',
    answer:
      'Pas d’après la liste de Service-Public : le lavage de véhicules ne figure pas parmi les activités pour lesquelles un devis est obligatoire (bâtiment, déménagement, location de voiture, services à la personne et quelques autres). Cette fiche date de 2022 : si vous exercez aussi une autre activité, vérifiez-la pour celle-là. En pratique, un devis reste la meilleure protection dès que le prix n’est pas celui d’une prestation standard.',
  },
  {
    question: 'Quelle durée de validité mettre sur un devis de lavage auto ?',
    answer:
      `Aucun texte ne la fixe pour le lavage auto : elle est libre, mais elle doit figurer sur le devis. Un mois est un repère courant, et c’est ${VALIDITE_DEVIS_JOURS} jours dans WashBoard par défaut. Raccourcissez-la si vos prix ou votre planning bougent vite, allongez-la pour un contrat saisonnier.`,
  },
  {
    question: 'Quelles mentions mettre sur un devis de lavage auto ?',
    answer:
      'La date, vos coordonnées complètes (nom légal, SIRET, adresse), celles du client, le lieu de la prestation, le détail ligne par ligne, les totaux hors taxes et toutes taxes comprises, la durée de validité et la mention de franchise de TVA si vous en bénéficiez. Aucune liste n’est imposée au lavage auto : celle-ci reprend ce que Service-Public exige dans les secteurs où le devis est obligatoire.',
  },
  {
    question: 'Un devis accepté doit-il être signé ?',
    answer:
      'Un devis n’engage les parties qu’une fois accepté. Une signature datée avec la mention « Bon pour accord », ou une acceptation écrite par message, vous donne une trace en cas de désaccord sur le prix. Gardez la réponse du client avec le devis.',
  },
  {
    question: 'Peut-on transformer un devis en facture ?',
    answer:
      'Oui, et c’est son intérêt : une fois la prestation faite, la facture reprend le client, les lignes et la remise du devis accepté, avec la date de la prestation. Avec WashBoard, un devis accepté se transforme en facture d’un tap, et la facture prend le numéro suivant de votre suite.',
  },
]

export default function Page() {
  return (
    <>
      <ArticleJsonLd article={article} siteUrl={SITE_URL} faq={faq} />
      <article>
        <ArticleHeader
          article={article}
          intro="« Ça ferait combien ? » est la question qui précède presque toute prestation qui sort de l’ordinaire. Un devis écrit répond avant que le malentendu naisse. Voici ce qu’il doit contenir, ce que la loi impose (ou pas) à un laveur auto, quelle durée de validité choisir, et un modèle à recopier."
        />

        <Summary
          items={[
            'Aucun texte n’impose un devis pour laver une voiture, mais il protège dès que le prix sort de votre grille : véhicule très sale, plusieurs véhicules, client professionnel.',
            'Pas de liste officielle de mentions pour le lavage auto : reprenez celles des secteurs où le devis est obligatoire (date, coordonnées, détail, HT et TTC, validité).',
            `La durée de validité est libre mais indispensable : ${VALIDITE_DEVIS_JOURS} jours est un bon point de départ, plus court si vos prix bougent.`,
            'Un devis vaut ce que vaut sa précision : « lavage complet » sans contenu ne protège de rien.',
            'Ce qui ne marche pas : le devis flou, le devis sans date de fin, le devis qu’on ne relance jamais et le prix qu’on change après accord.',
          ]}
        />

        <P>
          Un client qui réserve un lavage à votre tarif affiché n&apos;a pas besoin de devis : le
          prix est écrit sur la page de réservation, il l&apos;a accepté en cliquant. Le devis
          devient utile quand la prestation n&apos;a pas de prix catalogue, et c&apos;est
          justement là que naissent les litiges.
        </P>

        <H2>Quand faire un devis, et quand s&apos;en passer</H2>
        <P>
          Un devis a un coût : du temps pour l&apos;écrire, et un client qui peut lire votre prix
          tranquillement et le comparer. Il se justifie quand le risque d&apos;un malentendu est plus
          grand que ce coût :
        </P>
        <UL>
          <li>un véhicule très sale ou une remise en état (poils d&apos;animaux, taches anciennes, désodorisation) dont la durée est difficile à prévoir ;</li>
          <li>plusieurs véhicules d&apos;un même client, surtout une entreprise (voir <A href="/blog/lavage-flotte-vehicules-entreprise">laver pour les entreprises</A>) ;</li>
          <li>une prestation hors grille : rénovation de sièges, traitement céramique, intervention récurrente à tarif négocié ;</li>
          <li>un client qui demande un prix avant de s&apos;engager, ou qui doit le faire valider par quelqu&apos;un d&apos;autre.</li>
        </UL>
        <P>
          Pour un lavage standard au tarif de votre grille, n&apos;en faites pas : un devis par
          lavage de 45 € vous prendrait plus de temps que le lavage. Le bon réflexe est la page de
          réservation, qui fixe le prix avant que le client ne confirme (voir{' '}
          <A href="/blog/tarifs-lavage-auto-domicile">comment fixer vos tarifs</A>).
        </P>

        <H2>Ce que la loi impose à un laveur auto (et ce qu&apos;elle n&apos;impose pas)</H2>
        <P>
          Service-Public tient la liste des activités pour lesquelles un devis est obligatoire :
          travaux et dépannage du bâtiment, déménagement, location de voiture, optique, appareillage
          auditif, services à la personne, produits pour compenser la perte d&apos;autonomie,
          chirurgie esthétique et prestations funéraires. Le lavage de véhicules n&apos;y figure pas
          (fiche « Devis obligatoire : activités concernées », vérifiée le 9 septembre 2022). Autre
          rappel de Service-Public : un devis n&apos;engage les parties qu&apos;une fois accepté
          (fiche « Tout savoir sur la facturation », vérifiée le 7 août 2026).
        </P>
        <P>
          Deux points valent d&apos;être connus. Le premier : cette liste est ancienne, et si vous
          cumulez le lavage avec une autre activité (ménage à domicile, par exemple), la règle de
          cette autre activité s&apos;applique pour elle. Le second : un micro-entrepreneur immatriculé
          comme entreprise artisanale doit indiquer son assurance professionnelle quand elle est
          obligatoire, avec les coordonnées de l&apos;assureur et la couverture géographique du
          contrat, sur le devis comme sur la facture (fiche « Documents commerciaux d&apos;une
          micro-entreprise », vérifiée le 8 décembre 2025). Reste à savoir si votre activité est
          artisanale : le guichet des formalités vous le dit à l&apos;immatriculation, et c&apos;est
          une question à poser avant de rédiger votre premier modèle.
        </P>

        <H2>Les mentions à faire figurer</H2>
        <P>
          Comme aucune liste n&apos;est imposée au lavage auto, le plus sûr est de reprendre celle
          que Service-Public exige là où le devis est obligatoire (le bâtiment, par exemple) : elle
          est de bon sens et un client, un comptable ou un juge s&apos;y retrouvent.
        </P>
        <Table
          head={['Mention', 'Pourquoi elle compte']}
          rows={[
            ['Date d’établissement et numéro du devis', 'Retrouver le bon document, et prouver à partir de quand le prix court.'],
            ['Vos coordonnées : nom légal, SIRET, adresse, téléphone', 'Identifier qui s’engage. Un devis sans SIRET ressemble à une annonce.'],
            ['Coordonnées du client et lieu de la prestation', 'Éviter la confusion entre deux adresses ou deux véhicules.'],
            ['Détail ligne par ligne : prestation, quantité, prix unitaire', 'C’est ce qui sépare « lavage complet » de ce que vous faites vraiment.'],
            ['Total hors taxes et toutes taxes comprises', 'Obligatoire dans les listes officielles. En franchise de TVA, les deux totaux sont identiques.'],
            ['Durée de validité', 'Jusqu’à quand votre prix tient. Sans elle, vous restez engagé sans limite.'],
            ['Mention de franchise de TVA, si vous en bénéficiez', 'Voir l’encadré ci-dessous : la formule change en septembre 2026.'],
            ['Assurance professionnelle, si vous êtes artisan et qu’elle est obligatoire', 'Exigée sur le devis comme sur la facture dans ce cas.'],
          ]}
        />
        <Callout>
          <p>
            <strong>Franchise de TVA :</strong>{' '}la mention « TVA non applicable, art. 293 B du CGI »
            est remplacée à compter du 1er septembre 2026 par « TVA non applicable, art. L. 223 et s.
            du CIBS » (code des impositions sur les biens et services). L&apos;ancienne référence reste
            tolérée jusqu&apos;au 31 décembre 2027, d&apos;après la fiche « Documents commerciaux d&apos;une
            micro-entreprise » de Service-Public (vérifiée le 8 décembre 2025). Reprenez la nouvelle
            formule sur vos prochains documents.
          </p>
        </Callout>

        <H2>La durée de validité : combien mettre</H2>
        <P>
          Aucun texte ne la fixe pour un lavage auto. Elle est libre, mais elle doit exister : un
          devis sans date de fin vous engage sur votre prix aussi longtemps que le client voudra
          bien le garder dans sa messagerie. Les repères ci-dessous sont indicatifs, pas des règles :
        </P>
        <UL>
          <li><strong>Un mois</strong>{' '}pour une prestation ponctuelle. C&apos;est le choix par défaut de WashBoard ({VALIDITE_DEVIS_JOURS} jours).</li>
          <li><strong>Une à deux semaines</strong>{' '}si votre planning est plein ou si le prix dépend d&apos;un produit dont le coût bouge.</li>
          <li><strong>Deux à trois mois</strong>{' '}pour un contrat saisonnier ou une flotte qui doit faire valider le budget en interne.</li>
        </UL>

        <H2>Un modèle de devis à recopier</H2>
        <P>
          Voici la forme d&apos;un devis complet pour un lavage à domicile. Les prix sont un exemple
          chiffré dans la fourchette indicative des{' '}
          <A href="/blog/tarifs-lavage-auto-domicile">tarifs du lavage auto à domicile</A> :
          ajustez-les aux vôtres.
        </P>
        <Table
          head={['Rubrique', 'Exemple']}
          rows={[
            ['En-tête', 'Devis n° D-00012, établi le 18/10/2026, valable jusqu’au 17/11/2026'],
            ['Prestataire', 'Dupont Lavage EI, SIRET 123 456 789 00012, 12 rue des Lilas, 95000 Cergy, 06 00 00 00 00'],
            ['Client', 'Mme Martin, 4 allée du Parc, 95800 Cergy, Peugeot 308 grise'],
            ['Lieu et date', 'Au domicile du client, date à convenir'],
            ['Lignes', 'Lavage complet intérieur et extérieur : 1 × 70,00 €. Traitement des poils d’animaux : 1 × 25,00 €. Déplacement : 1 × 10,00 €'],
            ['Total', 'Total TTC : 105,00 €. TVA non applicable (franchise en base)'],
            ['Conditions', 'Paiement le jour de la prestation. Annulation sans frais jusqu’à 24 h avant.'],
            ['Accord', 'Date, signature et mention « Bon pour accord » du client'],
          ]}
        />
        <P>
          Les noms, le SIRET et les prix de cet exemple sont fictifs. Une ligne de plus qu&apos;il
          faut savoir écrire : tout ce que le devis ne couvre pas. « Toute durée supplémentaire fait
          l&apos;objet d&apos;un accord préalable » vaut mieux qu&apos;une dispute devant la voiture.
        </P>

        <H2>Faire accepter un devis, et le suivre</H2>
        <P>
          Un devis envoyé et oublié est un devis perdu. Trois habitudes changent le taux
          d&apos;acceptation sans changer le prix : l&apos;envoyer dans l&apos;heure plutôt que le
          lendemain, tant que le client pense encore à sa voiture ; le relancer une fois par un
          message court quelques jours plus tard ; le relancer une dernière fois à l&apos;approche de
          sa date de fin. Notez aussi la réponse, même un refus : un client qui dit non au prix
          aujourd&apos;hui peut dire oui pour un lavage simple le mois prochain.
        </P>
        <P>
          Une fois accepté, faites la prestation aux conditions écrites, et facturez ce qui a été
          convenu. Le devis devient alors la base de votre facture : voir{' '}
          <A href="/facturation-laveur-auto">la facturation d&apos;un laveur auto mobile</A>.
        </P>

        <H2>Ce qui ne marche pas</H2>
        <UL>
          <li>
            <strong>Le devis flou.</strong>{' '}« Lavage complet : 90 € » ne dit pas ce qui est inclus.
            Le jour où le client attendait les tapis et les vitres intérieures, c&apos;est vous qui
            avez tort aux yeux de tout le monde.
          </li>
          <li>
            <strong>Le « à partir de ».</strong>{' '}Un prix plancher sans plafond n&apos;est pas un
            devis : le client retient le plancher, et la différence se règle à la fin, dans la
            gêne.
          </li>
          <li>
            <strong>Pas de date de fin.</strong>{' '}Le prix d&apos;un produit ou d&apos;un trajet change
            en six mois, votre devis reste.
          </li>
          <li>
            <strong>Un devis pour tout.</strong>{' '}Écrire un devis pour un lavage standard fait perdre
            du temps des deux côtés. Réservez-le à ce qui sort de la grille.
          </li>
          <li>
            <strong>Changer le prix après accord.</strong>{' '}Même si le véhicule était plus sale que
            prévu. Si ce risque est réel, écrivez-le dans le devis (surcoût au-delà de telle durée)
            ou passez voir le véhicule avant de chiffrer.
          </li>
          <li>
            <strong>Ne rien garder.</strong>{' '}Un devis accepté par message vocal ne prouve rien.
            Demandez une confirmation écrite, même d&apos;un mot.
          </li>
        </UL>

        <H2>Les écrire sans y passer la soirée</H2>
        <P>
          Le vrai problème n&apos;est pas la forme du devis, c&apos;est le moment où vous
          l&apos;écrivez : sur le parking du client, entre deux voitures, sur votre téléphone.
          Un modèle Word recopié le soir donne un devis tardif, et un devis tardif est un client qui
          a rappelé le concurrent.
        </P>

        <Faq items={faq} />

        <Cta
          title="Un devis écrit depuis votre téléphone, sur place"
          secondary={lienPageMetier(article.theme)}
        >
          Avec WashBoard, en formule {requiredPlanLabel('facturation')} ({tarifOffre(offreDevis)}),
          vous écrivez le devis depuis la version mobile, sans rendez-vous derrière : client, lignes,
          total et date de validité ({VALIDITE_DEVIS_JOURS} jours proposés). Il part par email avec son PDF
          ou par WhatsApp, vous notez la réponse du client, et un devis accepté se transforme en
          facture d&apos;un tap. Vos informations de facturation (nom légal, SIRET, adresse) doivent
          être renseignées pour émettre un document. Il n&apos;y a pas de signature électronique :
          la réponse du client est notée par vos soins.
        </Cta>

        <AlsoRead
          items={[
            { href: '/facturation-laveur-auto', label: 'Facturation pour laveur auto mobile : SIRET, TVA, numérotation' },
            { href: '/blog/lavage-flotte-vehicules-entreprise', label: 'Laver pour les entreprises : flottes, concessions, loueurs, auto-écoles' },
            { href: '/blog/micro-entreprise-laveur-auto-mobile', label: 'Micro-entreprise pour laveur auto mobile : code APE, cotisations, démarches' },
            { href: '/blog/tarifs-lavage-auto-domicile', label: 'Quels tarifs pratiquer en lavage auto à domicile' },
          ]}
        />
      </article>
    </>
  )
}

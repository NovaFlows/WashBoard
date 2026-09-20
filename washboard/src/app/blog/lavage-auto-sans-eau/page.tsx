import type { Metadata } from 'next'
import { getArticle, SITE_URL } from '@/lib/blog'
import { H2, P, UL, A, Callout, Table, Summary, Faq, ArticleHeader, Cta, AlsoRead, ArticleJsonLd, type FaqItem } from '@/components/blog/Prose'

const article = getArticle('lavage-auto-sans-eau')!
const url = `${SITE_URL}/blog/${article.slug}`

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
    section: 'Méthode',
  },
  twitter: {
    card: 'summary_large_image',
    title: article.title,
    description: article.description,
  },
}

const faq: FaqItem[] = [
  {
    question: 'Le lavage sans eau abîme-t-il la carrosserie ?',
    answer:
      'Pas si le produit et la méthode sont adaptés : un produit lubrifiant appliqué généreusement, une microfibre propre par zone et des passages sans pression. Le risque de micro-rayures vient d’une microfibre sale ou réutilisée, ou d’un véhicule couvert de boue ou de sable qu’il aurait fallu pré-rincer. Sur un véhicule normalement sale, le résultat est équivalent à un lavage classique.',
  },
  {
    question: 'Combien de temps prend un lavage auto sans eau ?',
    answer:
      'Comptez 30 à 45 minutes pour un extérieur de citadine ou berline, 45 à 60 minutes pour un SUV, hors intérieur. C’est comparable à un lavage à l’eau, sans le temps d’installation de la cuve et du nettoyeur ni le temps de rangement.',
  },
  {
    question: 'Quels produits utiliser pour un lavage sans eau ?',
    answer:
      'Un produit de lavage sans eau (waterless wash) à pulvériser, des microfibres épaisses en quantité (une dizaine par véhicule, une par zone), un nettoyant jantes séparé, un nettoyant vitres et un produit pour les plastiques intérieurs. Un aspirateur sur batterie complète le kit pour l’intérieur.',
  },
  {
    question: 'Peut-on laver une voiture sans eau sur la voie publique ?',
    answer:
      'L’interdiction de laver sur la voie publique vise les rejets d’eaux de lavage au caniveau. Le lavage sans eau ne produit pas de ruissellement, ce qui lève cette contrainte dans la plupart des cas — mais le stationnement et l’occupation de la voie publique restent régis par la commune. Vérifiez en mairie, et privilégiez les parkings privés et d’entreprise.',
  },
  {
    question: 'Le lavage sans eau est-il vraiment écologique ?',
    answer:
      'Un lavage classique consomme 100 à 200 litres d’eau à domicile et rejette des détergents dans le caniveau ; un lavage sans eau utilise moins d’un litre de produit et aucun rejet. C’est un argument réel auprès des clients, à condition de ne pas le survendre : les microfibres doivent être lavées et les produits ont eux-mêmes un impact.',
  },
]

export default function Page() {
  return (
    <>
      <ArticleJsonLd article={article} siteUrl={SITE_URL} faq={faq} />
      <article>
        <ArticleHeader
          article={article}
          intro="La plupart des laveurs mobiles qui durent finissent par passer au sans-eau, au moins pour une partie de leur activité. Pas par conviction écologique : parce que ça leur permet d'intervenir partout, sans cuve, sans évacuation, sans mairie."
        />

        <Summary
          items={[
            'Le lavage sans eau consiste à pulvériser un produit lubrifiant et à essuyer à la microfibre, zone par zone, sans rinçage ni ruissellement.',
            'Son vrai intérêt pour un laveur mobile : plus de contrainte d’évacuation des eaux, accès aux parkings d’entreprise et aux copropriétés, moins de matériel à transporter.',
            'Ses limites : un véhicule couvert de boue, les jantes très encrassées et le dessous de caisse demandent un pré-rinçage ou un autre outil.',
            '30 à 45 minutes pour un extérieur de berline, une dizaine de microfibres propres par véhicule.',
            'C’est aussi un argument commercial auprès des clients et des entreprises soucieuses de leur image.',
          ]}
        />

        <P>
          Le terme est un peu trompeur : « sans eau » signifie sans rinçage et sans ruissellement,
          pas sans aucun liquide. Le produit est une émulsion qui encapsule la saleté et lubrifie
          la surface ; la microfibre l&apos;emporte au lieu de la frotter. Bien fait, le résultat est
          indiscernable d&apos;un lavage classique. Mal fait, ça raye. Toute la différence tient à la
          méthode.
        </P>

        <H2>Pourquoi c&apos;est le bon choix pour un laveur mobile</H2>
        <P>
          Quand on lave à domicile, le problème numéro un n&apos;est pas la saleté, c&apos;est
          l&apos;eau : où la prendre, comment la transporter, et surtout où la faire partir. Laver
          sur la voie publique est interdit dans la plupart des communes, et un client sur deux
          n&apos;a ni jardin ni allée où le ruissellement soit acceptable. Nous en parlons dans{' '}
          <A href="/blog/devenir-laveur-auto-mobile">le guide pour se lancer</A>.
        </P>
        <P>Le sans-eau supprime cette question, et en règle trois autres au passage :</P>
        <UL>
          <li>
            <strong>Les parkings d&apos;entreprise et les copropriétés</strong>{' '}deviennent
            accessibles. C&apos;est là que sont les flottes, les concessions et les clients qui font
            laver leur voiture pendant qu&apos;ils travaillent — donc les journées les plus
            rentables, sans trajet entre deux véhicules.
          </li>
          <li>
            <strong>Le matériel tient dans une citadine.</strong>{' '}Pas de cuve de 400 litres, pas
            de nettoyeur haute pression, pas de groupe électrogène pour l&apos;alimenter. Un
            aspirateur sur batterie, des pulvérisateurs et un sac de microfibres suffisent.
          </li>
          <li>
            <strong>Zéro temps d&apos;installation.</strong>{' '}Vous arrivez, vous commencez. Sur une
            journée de cinq véhicules, ce sont vingt à trente minutes récupérées.
          </li>
        </UL>

        <H2>La méthode qui ne raye pas</H2>
        <P>
          Les rayures viennent toujours de la même chose : une particule abrasive frottée sur le
          vernis. Toute la méthode consiste à ne jamais frotter à sec et à ne jamais réutiliser une
          microfibre chargée.
        </P>
        <UL>
          <li>
            <strong>Pulvériser généreusement</strong>{' '}sur une zone d&apos;environ 50 × 50 cm. Le
            produit doit couvrir, pas humidifier. Trop peu de produit est l&apos;erreur la plus
            fréquente chez les débutants qui veulent économiser.
          </li>
          <li>
            <strong>Essuyer dans un seul sens</strong>, sans pression, avec une microfibre pliée en
            quatre. Chaque face de la microfibre sert une fois ; au bout de huit faces, elle va au
            sac de linge sale.
          </li>
          <li>
            <strong>Lustrer avec une seconde microfibre sèche</strong>{' '}immédiatement, avant que le
            produit ne sèche.
          </li>
          <li>
            <strong>Du haut vers le bas</strong>{' '}: toit, vitres, capot, portes, puis les bas de
            caisse en dernier avec des microfibres dédiées — c&apos;est la zone la plus abrasive.
          </li>
        </UL>
        <Callout>
          <p>
            <strong>Le test avant de commencer.</strong>{' '}Passez un doigt sur une aile. Si vous
            sentez du grain (sable, boue séchée, résidus de chantier), le véhicule n&apos;est pas un
            candidat au sans-eau direct. Un pré-rinçage au pulvérisateur à pression ou un
            report vers un lavage à l&apos;eau évitera une carrosserie rayée — et une réclamation.
          </p>
        </Callout>

        <H2>Ce que le sans-eau ne fait pas bien</H2>
        <P>
          Il faut être honnête avec les clients et avec soi-même : ce n&apos;est pas la solution à
          tout.
        </P>
        <Table
          head={['Situation', 'Sans eau', 'Alternative']}
          rows={[
            ['Véhicule normalement sale (poussière, pluie, pollen)', 'Parfait', '—'],
            ['Boue, sable, sel de route', 'À éviter sans pré-rinçage', 'Pré-rinçage ou lavage à l’eau'],
            ['Jantes très encrassées (poussière de frein)', 'Insuffisant', 'Nettoyant jantes + brosse, rinçage local'],
            ['Dessous de caisse, passages de roue', 'Impossible', 'Haute pression'],
            ['Insectes, goudron', 'Correct avec un produit dédié', 'Produit spécifique + temps de pose'],
            ['Intérieur (sièges, plastiques, vitres)', 'Sans objet', 'Même méthode qu’un lavage classique'],
          ]}
        />
        <P>
          Beaucoup de laveurs mobiles travaillent donc en mixte : sans-eau par défaut, avec un
          pulvérisateur à pression de 10 à 15 litres pour un pré-rinçage ponctuel quand le
          véhicule l&apos;exige. Ça reste transportable, et ça couvre 95 % des situations.
        </P>

        <H2>Le matériel et les consommables</H2>
        <Table
          head={['Poste', 'Budget indicatif', 'Remarque']}
          rows={[
            ['Produit de lavage sans eau', '15 – 40 € / L', '50 à 100 ml par véhicule selon la taille'],
            ['Microfibres (lot de 20 à 30)', '40 – 90 €', 'Une dizaine par véhicule, lavées à 40 °C sans adoucissant'],
            ['Pulvérisateurs', '10 – 60 €', 'Un par produit, étiquetés'],
            ['Nettoyant jantes + brosse', '20 – 40 €', 'Indispensable, le sans-eau ne suffit pas'],
            ['Aspirateur sur batterie', '150 – 400 €', 'Pour l’intérieur, sans dépendre d’une prise'],
            ['Pulvérisateur à pression 10–15 L', '30 – 80 €', 'Pré-rinçage ponctuel'],
          ]}
        />
        <P>
          Le coût en consommables tourne autour de 3 à 6 € par véhicule, produit et lavage des
          microfibres compris. C&apos;est à intégrer dans{' '}
          <A href="/blog/tarifs-lavage-auto-domicile">votre calcul de tarif</A>, pas à négliger : sur
          trente voitures par semaine, ce sont plus de 100 €.
        </P>

        <H2>Comment le vendre au client</H2>
        <P>
          Les clients ne demandent pas un lavage sans eau. Ils demandent une voiture propre, chez
          eux, sans s&apos;en occuper. Le sans-eau n&apos;est pas un produit à vendre, c&apos;est
          un argument à sortir au bon moment :
        </P>
        <UL>
          <li>
            <strong>Face à une objection pratique</strong>{' '}(« je n&apos;ai pas de point
            d&apos;eau », « je suis en copropriété », « c&apos;est sur le parking du bureau ») :
            c&apos;est la réponse qui débloque le rendez-vous.
          </li>
          <li>
            <strong>Face aux entreprises</strong>{' '}: pas de flaque sur leur parking, pas de
            question de conformité, et un argument RSE qu&apos;elles pourront reprendre à leur
            compte.
          </li>
          <li>
            <strong>Sur votre fiche Google et votre page de réservation</strong>{' '}: « sans eau,
            intervention partout, y compris sur parking » filtre les recherches vers vous. Voir{' '}
            <A href="/blog/fiche-google-laveur-auto-mobile">comment configurer sa fiche Google</A>.
          </li>
        </UL>
        <P>
          Évitez en revanche de faire de l&apos;écologie le message principal. Ça attire des
          curieux, rarement des clients récurrents. Ce qui fidélise, c&apos;est le résultat et la
          facilité de réserver.
        </P>

        <Faq items={faq} />

        <Cta title="Réservez plus de parkings d'entreprise">
          Avec WashBoard, vos clients pros réservent sur un lien à votre nom, indiquent le parking
          et le nombre de véhicules, et vos rendez-vous sont groupés par secteur. Vous arrivez avec
          vos microfibres, le reste est déjà organisé.
        </Cta>

        <AlsoRead
          items={[
            { href: '/blog/devenir-laveur-auto-mobile', label: 'Devenir laveur auto mobile : par où commencer' },
            { href: '/blog/assurance-laveur-auto-mobile', label: 'Quelle assurance pour un laveur auto mobile' },
            { href: '/blog/tarifs-lavage-auto-domicile', label: 'Quels tarifs pratiquer en lavage auto à domicile' },
          ]}
        />
      </article>
    </>
  )
}

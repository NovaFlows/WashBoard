import type { Metadata } from 'next'
import { getArticle, SITE_URL } from '@/lib/blog'
import { H2, P, UL, A, Callout, Table, Summary, Faq, ArticleHeader, Cta, AlsoRead, ArticleJsonLd, type FaqItem } from '@/components/blog/Prose'

const article = getArticle('assurance-laveur-auto-mobile')!
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
    section: 'Se lancer',
  },
  twitter: {
    card: 'summary_large_image',
    title: article.title,
    description: article.description,
  },
}

const faq: FaqItem[] = [
  {
    question: 'L’assurance RC pro est-elle obligatoire pour un laveur auto mobile ?',
    answer:
      'Le lavage automobile n’est pas une profession réglementée : la RC pro n’y est pas imposée par la loi, contrairement au bâtiment ou à la santé. Elle est en revanche indispensable en pratique : sans elle, une rayure sur une carrosserie, un cuir marqué ou un élément arraché sont à votre charge, et la plupart des clients professionnels (garages, flottes) exigent une attestation avant de vous confier un véhicule.',
  },
  {
    question: 'Qu’est-ce que la garantie « biens confiés » ?',
    answer:
      'C’est l’extension de la RC pro qui couvre les dommages causés aux biens que le client vous a confiés — ici, sa voiture — pendant que vous travaillez dessus. Une RC pro standard couvre les dommages causés aux tiers et à leurs biens, mais exclut souvent le bien sur lequel porte la prestation. Pour un laveur, c’est précisément ce bien-là qu’il faut couvrir.',
  },
  {
    question: 'Combien coûte une assurance pour un laveur auto mobile ?',
    answer:
      'Pour une RC pro avec garantie biens confiés en micro-entreprise, comptez généralement quelques dizaines d’euros par mois — de l’ordre de 20 à 50 € selon le chiffre d’affaires déclaré, les plafonds de garantie et la franchise. L’assurance du véhicule à usage professionnel s’ajoute, à un tarif proche d’une assurance auto classique majorée pour l’usage pro.',
  },
  {
    question: 'Mon assurance auto personnelle couvre-t-elle mon véhicule de travail ?',
    answer:
      'En général non : un contrat auto « usage privé » ou « trajet domicile-travail » ne couvre pas les déplacements professionnels avec du matériel à bord. En cas d’accident pendant une tournée, l’assureur peut refuser la prise en charge. Déclarez l’usage professionnel, ou souscrivez un contrat dédié si vous utilisez un utilitaire.',
  },
  {
    question: 'Que faire si j’abîme la voiture d’un client ?',
    answer:
      'Prévenez le client immédiatement, photographiez le dommage, et déclarez le sinistre à votre assureur dans le délai prévu au contrat (souvent cinq jours ouvrés). Ne proposez pas de réparer vous-même ou de « s’arranger » sans en parler à l’assureur : cela peut vous priver de la garantie. Les photos avant prestation, prises systématiquement, sont votre meilleure protection contre les dommages préexistants qu’on vous attribuerait.',
  },
]

export default function Page() {
  return (
    <>
      <ArticleJsonLd article={article} siteUrl={SITE_URL} faq={faq} />
      <article>
        <ArticleHeader
          article={article}
          intro="Vous manipulez, chaque jour, le deuxième bien le plus cher de vos clients. Une rayure sur un noir métallisé se chiffre en centaines d'euros, un cuir marqué par un produit en milliers. Voici ce qu'il faut couvrir, ce qu'il faut vérifier dans le contrat, et les réflexes qui évitent les litiges."
        />

        <Summary
          items={[
            'La RC pro n’est pas obligatoire légalement pour le lavage auto, mais indispensable : sans elle, chaque dommage est pour vous.',
            'Le point décisif : la garantie « biens confiés », qui couvre la voiture du client pendant la prestation. Une RC pro standard l’exclut souvent.',
            'Votre véhicule doit être assuré pour un usage professionnel ; le matériel à bord peut être couvert en option.',
            'Vérifiez les exclusions : haute pression, produits chimiques, véhicules de valeur, travail sur voie publique.',
            'Photos systématiques avant chaque prestation, déclaration rapide en cas de sinistre.',
          ]}
        />

        <Callout>
          <p>
            <strong>Cet article n&apos;est pas un conseil d&apos;assurance.</strong>{' '}Les garanties,
            exclusions et tarifs varient d&apos;un assureur à l&apos;autre et changent dans le temps.
            Il vous donne la liste des points à vérifier ; c&apos;est le contrat, et lui seul, qui
            fait foi. Faites-vous confirmer chaque point par écrit avant de signer.
          </p>
        </Callout>

        <H2>Les trois contrats qui concernent un laveur mobile</H2>
        <Table
          head={['Contrat', 'Ce qu’il couvre', 'Indispensable ?']}
          rows={[
            ['RC professionnelle + biens confiés', 'Les dommages causés au client, aux tiers, et au véhicule sur lequel vous travaillez', 'Oui'],
            ['Assurance du véhicule à usage pro', 'Votre voiture ou utilitaire pendant les tournées, avec le matériel à bord (option)', 'Oui'],
            ['Protection juridique', 'Les frais en cas de litige avec un client ou un fournisseur', 'Recommandée'],
            ['Multirisque matériel', 'Vol ou casse du matériel hors véhicule', 'Selon la valeur du matériel'],
            ['Prévoyance (arrêt de travail)', 'Un revenu si vous ne pouvez plus travailler', 'À envisager dès que c’est votre seul revenu'],
          ]}
        />

        <H2>1. La RC pro : lisez la ligne « biens confiés »</H2>
        <P>
          Une responsabilité civile professionnelle couvre les dommages que vous causez aux
          autres dans le cadre de votre activité : le client qui glisse sur votre flaque, le
          voisin dont la voiture reçoit des projections. C&apos;est nécessaire, mais ce n&apos;est
          pas le risque principal d&apos;un laveur.
        </P>
        <P>
          Le risque principal, c&apos;est la voiture elle-même. Et beaucoup de contrats RC pro
          excluent les dommages au bien qui fait l&apos;objet de la prestation — précisément parce
          que c&apos;est là que les sinistres arrivent. La garantie qui les réintègre s&apos;appelle
          <strong>{' '}« biens confiés »</strong> (ou « objets confiés », « biens en garde »). Sans
          elle, vous êtes assuré pour tout sauf pour ce qui compte.
        </P>
        <P>Sur cette garantie, quatre chiffres à vérifier :</P>
        <UL>
          <li>
            <strong>Le plafond par sinistre.</strong>{' '}Il doit dépasser la valeur des véhicules
            que vous lavez. 10 000 € suffisent pour des citadines, pas pour une clientèle de
            berlines allemandes ou de véhicules de collection.
          </li>
          <li>
            <strong>La franchise.</strong>{' '}Ce qui reste à votre charge à chaque sinistre.
            Entre 150 et 500 € le plus souvent ; une franchise basse coûte plus cher chaque mois.
          </li>
          <li>
            <strong>Le plafond annuel.</strong>{' '}Le total que l&apos;assureur paiera sur
            l&apos;année, tous sinistres confondus.
          </li>
          <li>
            <strong>La valeur maximale du véhicule couvert.</strong>{' '}Certains contrats excluent
            les véhicules au-delà d&apos;un certain prix. Si vous visez le detailing haut de gamme,
            c&apos;est la première question à poser.
          </li>
        </UL>

        <H2>2. Les exclusions qui piègent les laveurs</H2>
        <P>
          Une garantie n&apos;a de valeur que si elle s&apos;applique à votre façon de travailler.
          Les exclusions à chercher dans les conditions générales, et à faire lever si besoin :
        </P>
        <UL>
          <li>
            <strong>Le nettoyeur haute pression.</strong>{' '}Certains contrats excluent les dommages
            causés par des « équipements sous pression ». Si vous travaillez au Kärcher, la
            garantie doit le mentionner explicitement.
          </li>
          <li>
            <strong>Les produits chimiques.</strong>{' '}Un cuir décoloré, un plastique blanchi, un
            vernis attaqué par un nettoyant jantes trop acide : ce sont des dommages « par produit »,
            parfois exclus ou plafonnés.
          </li>
          <li>
            <strong>Le travail sur la voie publique.</strong>{' '}Si le contrat exige que la
            prestation ait lieu sur terrain privé, laver dans la rue vous fait sortir de la
            garantie — en plus d&apos;être souvent interdit par la commune. C&apos;est un argument
            de plus pour le <A href="/blog/lavage-auto-sans-eau">lavage sans eau</A>, qui se pratique
            sur les parkings.
          </li>
          <li>
            <strong>La conduite du véhicule client.</strong>{' '}Déplacer une voiture de trois
            mètres pour la mettre à l&apos;ombre relève de la garantie « conduite de véhicules
            confiés », distincte de la précédente et rarement incluse par défaut. Dans le doute,
            ne déplacez jamais un véhicule client.
          </li>
          <li>
            <strong>La sous-traitance et les salariés.</strong>{' '}Le jour où vous faites travailler
            quelqu&apos;un d&apos;autre, le contrat doit le prévoir.
          </li>
        </UL>

        <H2>3. Votre véhicule et votre matériel</H2>
        <P>
          Une assurance auto personnelle couvre un usage privé, parfois les trajets
          domicile-travail. Elle ne couvre pas, en général, les déplacements professionnels avec
          du matériel à bord — et l&apos;assureur peut le vérifier après un accident survenu un
          mardi à 10 h entre deux clients. Déclarez l&apos;usage professionnel, ou passez sur un
          contrat dédié si vous roulez en utilitaire.
        </P>
        <P>
          Le matériel (aspirateur, nettoyeur, produits, microfibres) représente vite 1 500 à
          3 000 € dans le coffre. La garantie « contenu » ou « marchandises transportées » le couvre
          en cas de vol ou d&apos;accident ; elle est le plus souvent en option. Rapportez son prix
          à la valeur de ce que vous transportez, et à ce que vous coûterait une semaine sans
          travailler le temps de tout racheter.
        </P>

        <H2>4. Ce que le contrat ne remplace pas : vos réflexes</H2>
        <P>
          La majorité des litiges entre laveurs et clients ne portent pas sur un dommage réel, mais
          sur un dommage <em>préexistant</em> que le client découvre après la prestation, parce
          qu&apos;une voiture propre montre tout. Une rayure invisible sous la poussière devient
          évidente une fois la carrosserie brillante. Trois habitudes règlent 90 % de ces situations :
        </P>
        <UL>
          <li>
            <strong>Le tour du véhicule avec le client, avant de commencer.</strong>{' '}Trente
            secondes. Vous pointez ce que vous voyez, à voix haute. Le client sait que vous
            l&apos;avez vu, vous savez qu&apos;il le sait.
          </li>
          <li>
            <strong>Les photos avant prestation, systématiques.</strong>{' '}Quatre angles, les jantes,
            l&apos;intérieur. Au téléphone, horodatées. Vous ne les regarderez presque jamais ; le
            jour où vous en aurez besoin, elles vaudront le contrat entier.
          </li>
          <li>
            <strong>La déclaration immédiate en cas de dommage.</strong>{' '}Vous prévenez le client,
            vous photographiez, vous déclarez à l&apos;assureur dans le délai du contrat. Vous ne
            proposez pas de réparer vous-même ou de rembourser de la main à la main : un
            arrangement hors assureur peut vous faire perdre la garantie, et un client qui accepte
            un « arrangement » revient rarement.
          </li>
        </UL>

        <H2>Avant de signer : la liste des questions</H2>
        <P>
          Posez-les par écrit et gardez les réponses. Un assureur sérieux y répond sans détour.
        </P>
        <UL>
          <li>Les dommages au véhicule que je lave sont-ils couverts (biens confiés) ? À quel plafond, avec quelle franchise ?</li>
          <li>Le nettoyeur haute pression et les produits de nettoyage sont-ils couverts ?</li>
          <li>Suis-je couvert sur un parking d&apos;entreprise ? Sur la voie publique ? Chez le client ?</li>
          <li>Y a-t-il une valeur maximale de véhicule ? Une exclusion pour les véhicules de collection ou de luxe ?</li>
          <li>Que se passe-t-il si je déplace le véhicule du client de quelques mètres ?</li>
          <li>Le contrat évolue-t-il si mon chiffre d&apos;affaires augmente ou si j&apos;embauche ?</li>
        </UL>
        <P>
          Ces vérifications prennent une heure. C&apos;est l&apos;heure la mieux investie de votre{' '}
          <A href="/blog/devenir-laveur-auto-mobile">lancement</A> : elle protège tout ce que vous
          construirez ensuite.
        </P>

        <Faq items={faq} />

        <Cta title="Chaque prestation documentée, sans y penser">
          Avec WashBoard, chaque rendez-vous garde le véhicule, la prestation, l&apos;adresse et
          l&apos;heure. Le jour où un client conteste, vous avez l&apos;historique complet sous la
          main.
        </Cta>

        <AlsoRead
          items={[
            { href: '/blog/devenir-laveur-auto-mobile', label: 'Devenir laveur auto mobile : par où commencer' },
            { href: '/blog/lavage-auto-sans-eau', label: 'Lavage auto sans eau : comment ça marche, pour qui, avec quoi' },
            { href: '/blog/combien-gagne-un-laveur-auto-mobile', label: 'Combien gagne un laveur auto mobile ? Revenus réels et simulation' },
          ]}
        />
      </article>
    </>
  )
}

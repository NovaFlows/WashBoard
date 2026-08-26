import type { Metadata } from 'next'
import { getArticle, SITE_URL } from '@/lib/blog'
import { H2, P, UL, Callout, Table, ArticleHeader, Cta, AlsoRead, ArticleJsonLd } from '@/components/blog/Prose'

const article = getArticle('devenir-laveur-auto-mobile')!
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
  },
  twitter: { card: 'summary_large_image', title: article.title, description: article.description },
}

export default function Page() {
  return (
    <>
      <ArticleJsonLd article={article} siteUrl={SITE_URL} />
      <article>
        <ArticleHeader
          article={article}
          intro="Le lavage auto à domicile est l'une des activités les plus accessibles à lancer : peu de capital, pas de local, une demande réelle. Ce qui fait la différence, ce sont quelques décisions prises au départ."
        />

        <P>
          Se lancer ne demande ni diplôme ni autorisation particulière. C&apos;est une force — et
          c&apos;est aussi pourquoi beaucoup démarrent mal : sans assurance adaptée, sans savoir ce
          que la loi impose sur les eaux de lavage, et avec du matériel choisi au hasard. Voici
          l&apos;ordre dans lequel prendre les choses.
        </P>

        <H2>1. Le statut : la micro-entreprise dans la quasi-totalité des cas</H2>
        <P>
          Pour démarrer seul, la micro-entreprise est le régime adapté : création gratuite en ligne,
          comptabilité réduite à un livre de recettes, et surtout aucune cotisation si vous ne
          facturez rien. Vous déclarez votre chiffre d&apos;affaires chaque mois ou chaque
          trimestre, et vous payez un pourcentage dessus.
        </P>
        <P>
          Le lavage de véhicules relève de la <strong>prestation de services</strong>, avec le code
          APE correspondant au lavage automobile. Ce détail compte : le taux de cotisations et le
          plafond de chiffre d&apos;affaires diffèrent de ceux de la vente de marchandises.
        </P>
        <Callout>
          <p>
            Les taux de cotisations, les plafonds et les exonérations de début d&apos;activité
            changent régulièrement. Vérifiez les chiffres en vigueur sur le site officiel de
            l&apos;URSSAF au moment où vous vous lancez plutôt que de vous fier à un article — y
            compris celui-ci.
          </p>
        </Callout>

        <H2>2. L&apos;assurance : le point que personne ne doit sauter</H2>
        <P>
          Vous manipulez le bien le plus cher de vos clients après leur logement. Une rayure sur une
          carrosserie foncée, un produit qui marque un cuir, un nettoyeur qui décolle un
          élément de finition : ça arrive, même en travaillant proprement.
        </P>
        <P>
          Il vous faut une <strong>responsabilité civile professionnelle</strong> qui couvre
          explicitement les <strong>biens confiés</strong>. C&apos;est cette clause qui prend en
          charge les dommages causés au véhicule lui-même. Une RC pro standard sans cette extension
          ne couvrira pas la voiture que vous êtes en train de laver — vérifiez-le noir sur blanc
          avant de signer.
        </P>

        <H2>3. L&apos;eau : la contrainte que la plupart découvrent trop tard</H2>
        <P>
          C&apos;est la spécificité du métier, et la source des mauvaises surprises. Laver un
          véhicule sur la voie publique est interdit dans la plupart des communes, et les eaux de
          lavage chargées en détergents et en hydrocarbures ne doivent pas partir dans les
          caniveaux, qui rejoignent souvent le milieu naturel sans traitement.
        </P>
        <P>Trois manières de travailler en règle :</P>
        <UL>
          <li>
            <strong>Le lavage sans eau ou à faible consommation.</strong>{' '}Des produits appliqués
            au pulvérisateur et essuyés à la microfibre, sans ruissellement. C&apos;est la solution
            la plus souple : vous intervenez sur un parking d&apos;entreprise ou devant chez le
            client sans contrainte d&apos;évacuation.
          </li>
          <li>
            <strong>Le lavage sur terrain privé</strong>{' '}avec l&apos;accord du propriétaire, quand
            les eaux s&apos;infiltrent sur une surface perméable.
          </li>
          <li>
            <strong>Un système de récupération</strong>{' '}des eaux usées, plus lourd à mettre en
            place mais nécessaire si vous voulez travailler au nettoyeur haute pression partout.
          </li>
        </UL>
        <P>
          Les règles précises dépendent de votre commune : renseignez-vous en mairie. Beaucoup de
          laveurs mobiles font le choix du sans-eau justement pour s&apos;affranchir de cette
          question, et en font un argument écologique auprès des clients.
        </P>

        <H2>4. Le matériel : commencer léger</H2>
        <P>
          La tentation est d&apos;acheter un équipement complet avant le premier client. C&apos;est
          l&apos;inverse qu&apos;il faut faire : démarrez avec le minimum viable, et réinvestissez
          ce que vous gagnez. Vous saurez au bout de vingt prestations ce dont vous avez réellement
          besoin.
        </P>

        <Table
          head={['Poste', 'Budget indicatif']}
          rows={[
            ['Aspirateur eau et poussière', '150 – 400 €'],
            ['Nettoyeur haute pression ou pulvérisateurs', '150 – 600 €'],
            ['Cuve à eau (si lavage avec eau)', '100 – 400 €'],
            ['Produits de départ', '150 – 300 €'],
            ['Microfibres, brosses, applicateurs', '100 – 200 €'],
            ['Groupe électrogène (optionnel)', '200 – 600 €'],
          ]}
        />

        <P>
          Un point souvent négligé : <strong>l&apos;électricité</strong>. Beaucoup de clients
          particuliers accepteront de vous brancher, mais pas tous, et jamais sur un parking
          d&apos;entreprise. Un groupe électrogène ou un aspirateur sur batterie élargit
          considérablement les endroits où vous pouvez travailler.
        </P>

        <H2>5. Trouver les premiers clients</H2>
        <P>
          Avant même votre première prestation, créez votre <strong>fiche d&apos;établissement
          Google</strong>. C&apos;est gratuit, et c&apos;est ce que consultent les gens qui
          cherchent un laveur près de chez eux. Une fiche prend quelques semaines à gagner en
          visibilité : plus tôt elle existe, mieux c&apos;est.
        </P>
        <P>
          Ensuite, demandez un avis après <strong>chaque</strong>{' '}prestation, dès la première.
          Dix avis quand vous démarrez pèsent bien plus lourd que dix avis de plus quand vous en
          avez déjà cinquante. C&apos;est l&apos;actif qui se construit le plus lentement, donc
          celui qu&apos;il faut commencer en premier.
        </P>

        <H2>Les erreurs de démarrage les plus coûteuses</H2>
        <UL>
          <li>
            <strong>Casser les prix pour démarrer.</strong>{' '}Vous attirez des clients qui partiront
            au premier concurrent moins cher, et vous vous enfermez dans une grille que vous
            n&apos;oserez plus augmenter.
          </li>
          <li>
            <strong>Accepter toutes les distances.</strong>{' '}Aller à quarante minutes pour une
            prestation à 40 € vous fait travailler pour rien. Définissez une zone, tenez-la.
          </li>
          <li>
            <strong>Sous-estimer les durées.</strong>{' '}Un intérieur très sale peut demander le
            double du temps prévu. Prévoyez de la marge entre deux rendez-vous, sinon vous serez en
            retard toute la journée.
          </li>
          <li>
            <strong>Tout gérer par messages.</strong>{' '}Au début c&apos;est tenable. À huit clients
            par jour, répondre à WhatsApp entre deux voitures devient un deuxième métier.
          </li>
        </UL>

        <Cta title="Être organisé dès le premier client">
          Une page de réservation à votre nom, un agenda qui se remplit seul, les demandes
          d&apos;avis envoyées automatiquement. WashBoard s&apos;occupe de l&apos;administratif
          pendant que vous lavez.
        </Cta>

        <AlsoRead
          items={[
            { href: '/blog/tarifs-lavage-auto-domicile', label: 'Quels tarifs pratiquer en lavage auto à domicile' },
            { href: '/blog/trouver-des-clients-laveur-auto-mobile', label: 'Comment trouver des clients quand on est laveur auto mobile' },
            { href: '/blog/organiser-ses-tournees-lavage-auto', label: 'Organiser ses tournées pour laver plus de voitures par jour' },
          ]}
        />
      </article>
    </>
  )
}

import type { Metadata } from 'next'
import { getArticle, SITE_URL } from '@/lib/blog'
import { lienPageMetier } from '@/lib/metiers'
import { requiredPlanLabel } from '@/lib/plan'
import { H2, P, UL, A, Table, Summary, Faq, ArticleHeader, Cta, AlsoRead, ArticleJsonLd, type FaqItem } from '@/components/blog/Prose'

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
    authors: ['WashBoard'],
    section: 'Se lancer',
  },
  twitter: { card: 'summary_large_image', title: article.title, description: article.description },
}

const faq: FaqItem[] = [
  {
    question: 'Faut-il un diplôme pour laver des voitures à domicile ?',
    answer:
      'Non, le métier s’apprend en pratiquant. Ce qui compte, c’est le geste (ne pas rayer, ne pas laisser de traces), le temps tenu par prestation et la qualité du premier résultat montré au client.',
  },
  {
    question: 'Quel budget pour se lancer en lavage auto mobile ?',
    answer:
      'Comptez entre 650 et 2 500 € de matériel selon que vous travaillez avec ou sans eau : aspirateur eau et poussière (150–400 €), nettoyeur haute pression ou pulvérisateurs (150–600 €), cuve à eau (100–400 €), produits de départ (150–300 €), microfibres et brosses (100–200 €), plus un groupe électrogène en option (200–600 €). Démarrez léger et réinvestissez ce que vous gagnez.',
  },
  {
    question: 'Avec ou sans eau : que choisir pour démarrer ?',
    answer:
      'Le lavage sans eau est le plus souple : il s’exécute au pulvérisateur et à la microfibre, sur un parking d’entreprise ou devant chez le client, sans cuve ni évacuation. L’eau (nettoyeur haute pression, cuve) donne de meilleurs résultats sur les véhicules très sales, mais demande plus de matériel et de logistique.',
  },
  {
    question: 'Comment trouver ses premiers clients ?',
    answer:
      'Créez votre fiche Google avant la première prestation, demandez un avis après chaque lavage, et groupez vos rendez-vous par quartier pour que le bouche-à-oreille reste local.',
  },
]

export default function Page() {
  return (
    <>
      <ArticleJsonLd article={article} siteUrl={SITE_URL} faq={faq} />
      <article>
        <ArticleHeader
          article={article}
          intro="Le lavage auto à domicile est l'une des activités les plus accessibles à lancer : peu de capital, pas de local, une demande réelle. Ce qui fait la différence, ce sont quelques décisions prises au départ : la méthode de lavage, le matériel, les premiers clients."
        />

        <Summary
          items={[
            'Aucun diplôme requis : le métier s’apprend en pratiquant, et la qualité du premier lavage fait le reste.',
            'Avec ou sans eau : le sans-eau est le plus souple pour démarrer, l’eau demande plus de matériel.',
            'Budget matériel de départ : 650 à 2 500 € selon la méthode. Commencez léger, réinvestissez.',
            'Créez votre fiche Google avant la première prestation, et demandez un avis dès la première.',
          ]}
        />

        <P>
          Se lancer ne demande ni diplôme ni gros capital. C&apos;est une force — et c&apos;est aussi
          pourquoi beaucoup démarrent mal : avec du matériel choisi au hasard, sans méthode de
          lavage claire et sans stratégie pour les premiers clients. Voici l&apos;ordre dans lequel
          prendre les choses. Pour le statut et les démarches, renseignez-vous auprès des
          organismes officiels : ici, on parle du métier.
        </P>

        <H2>1. Avec ou sans eau : choisir sa méthode</H2>
        <P>
          C&apos;est la spécificité du métier, et elle conditionne tout le reste : le matériel, les
          endroits où vous pouvez travailler, le temps par voiture. Trois manières de travailler :
        </P>
        <UL>
          <li>
            <strong>Le lavage sans eau ou à faible consommation.</strong>{' '}Des produits appliqués
            au pulvérisateur et essuyés à la microfibre, sans ruissellement. C&apos;est la solution
            la plus souple : vous intervenez sur un parking d&apos;entreprise ou devant chez le
            client sans contrainte d&apos;évacuation.
          </li>
          <li>
            <strong>Le lavage avec eau chez le client</strong>{' '}quand il dispose d&apos;un
            espace adapté (cour, garage, terrain) et d&apos;un point d&apos;eau.
          </li>
          <li>
            <strong>Un système de récupération</strong>{' '}des eaux usées, plus lourd à mettre en
            place mais utile si vous voulez travailler au nettoyeur haute pression à plusieurs
            endroits.
          </li>
        </UL>
        <P>
          Beaucoup de laveurs mobiles font le choix du{' '}
          <A href="/blog/lavage-auto-sans-eau">lavage sans eau</A>{' '}pour simplifier la logistique,
          et en font un argument écologique auprès des clients.
        </P>

        <H2>2. Le matériel : commencer léger</H2>
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

        <H2>3. Trouver les premiers clients</H2>
        <P>
          Avant même votre première prestation, créez votre <strong>fiche d&apos;établissement
          Google</strong>. C&apos;est gratuit, et c&apos;est ce que consultent les gens qui
          cherchent un laveur près de chez eux. Une fiche prend quelques semaines à gagner en
          visibilité : plus tôt elle existe, mieux c&apos;est. Les autres canaux qui marchent sont
          détaillés dans{' '}
          <A href="/blog/trouver-des-clients-laveur-auto-mobile">notre guide pour trouver des clients</A>.
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
            n&apos;oserez plus augmenter. Calculez plutôt{' '}
            <A href="/blog/tarifs-lavage-auto-domicile">un tarif qui couvre vraiment vos coûts</A>.
          </li>
          <li>
            <strong>Accepter toutes les distances.</strong>{' '}Aller à quarante minutes pour une
            prestation à 40 € vous fait travailler pour rien. Définissez une zone, tenez-la, et{' '}
            <A href="/blog/organiser-ses-tournees-lavage-auto">groupez vos rendez-vous par secteur</A>.
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

        <Faq items={faq} />

        <Cta
          title="Être organisé dès le premier client"
          secondary={lienPageMetier(article.theme)}
        >
          Une page de réservation à votre nom, un acompte et une carte de fidélité si vous le
          souhaitez, les demandes d&apos;avis Google envoyées automatiquement et la facture créée à
          la fin de chaque rendez-vous (à partir de la formule {requiredPlanLabel('facturation')}).
          WashBoard s&apos;occupe de l&apos;administratif pendant que vous lavez.
        </Cta>

        <AlsoRead
          items={[
            { href: '/blog/lavage-auto-sans-eau', label: 'Lavage auto sans eau : comment ça marche, pour qui, avec quoi' },
            { href: '/blog/combien-gagne-un-laveur-auto-mobile', label: 'Combien gagne un laveur auto mobile ? Revenus réels et simulation' },
            { href: '/blog/tarifs-lavage-auto-domicile', label: 'Quels tarifs pratiquer en lavage auto à domicile' },
          ]}
        />
      </article>
    </>
  )
}

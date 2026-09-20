import type { Metadata } from 'next'
import { getArticle, SITE_URL } from '@/lib/blog'
import { H2, P, UL, A, Callout, Table, Summary, Faq, ArticleHeader, Cta, AlsoRead, ArticleJsonLd, type FaqItem } from '@/components/blog/Prose'

const article = getArticle('tarifs-lavage-auto-domicile')!
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
    section: 'Tarifs',
  },
  twitter: { card: 'summary_large_image', title: article.title, description: article.description },
}

const faq: FaqItem[] = [
  {
    question: 'Quel est le prix moyen d’un lavage auto à domicile ?',
    answer:
      'En France, un lavage extérieur à domicile se facture généralement entre 25 et 45 €, un intérieur entre 35 et 60 €, et un lavage complet entre 55 et 95 € pour une citadine ou une berline. Un nettoyage en profondeur (plusieurs heures) va de 120 à 250 €. Comptez 30 à 50 % de plus pour un SUV, un monospace ou un utilitaire.',
  },
  {
    question: 'Combien facturer de l’heure en lavage auto mobile ?',
    answer:
      'Partez du revenu mensuel visé, ajoutez vos charges et vos cotisations (environ 21 à 22 % du chiffre d’affaires en micro-entreprise pour une prestation de services), puis divisez par le nombre d’heures réellement facturées dans le mois — pas par les heures travaillées. Le résultat est votre taux horaire plancher ; en pratique il se situe rarement en dessous de 35 à 45 € de l’heure.',
  },
  {
    question: 'Faut-il facturer les frais de déplacement pour un lavage à domicile ?',
    answer:
      'Oui, d’une manière ou d’une autre. Soit vous définissez une zone dans laquelle le déplacement est inclus dans le prix, soit vous ajoutez un supplément fixe ou au kilomètre au-delà. La seule erreur est de ne rien prévoir : ce qui coûte cher n’est pas le carburant mais le temps de route, qui remplace une prestation.',
  },
  {
    question: 'Quand augmenter ses tarifs de lavage auto ?',
    answer:
      'Quand votre agenda est plein trois semaines à l’avance et que vous refusez des clients : la demande dépasse votre capacité. Une révision annuelle de l’ordre de 5 % est par ailleurs normale pour suivre le coût des produits, du carburant et des cotisations ; vos clients fidèles ne partiront pas pour ça.',
  },
]

export default function Page() {
  return (
    <>
      <ArticleJsonLd article={article} siteUrl={SITE_URL} faq={faq} />
      <article>
        <ArticleHeader
          article={article}
          intro="La plupart des laveurs qui démarrent fixent leurs prix en regardant ceux du voisin, puis retirent cinq euros. C'est le meilleur moyen de travailler beaucoup pour gagner peu. Voici comment calculer un tarif qui tient."
        />

        <Summary
          items={[
            'Raisonnez à l’heure facturée, pas à la prestation : chronométrez-vous trajet compris sur dix prestations.',
            'Votre prix couvre votre temps, les consommables, l’amortissement du matériel, vos cotisations (≈ 21–22 % en micro-entreprise) et le temps non facturé.',
            'Fourchettes courantes en France : 25–45 € l’extérieur, 35–60 € l’intérieur, 55–95 € le complet, +30 à 50 % pour SUV et utilitaires.',
            'Prévoyez le déplacement : zone incluse ou supplément au-delà, mais jamais rien.',
            'Agenda plein trois semaines à l’avance = le moment d’augmenter.',
          ]}
        />

        <P>
          Le lavage auto à domicile se vend cher parce qu&apos;il vend du temps gagné, pas du
          nettoyage. Le client ne compare pas votre prix à celui du rouleau de la station : il le
          compare aux quarante minutes qu&apos;il ne passera pas à faire la queue un samedi
          après-midi. Vos tarifs doivent refléter ce service, pas le prix d&apos;un lavage
          automatique.
        </P>

        <H2>Commencez par le temps réel, pas par le prix</H2>
        <P>
          L&apos;erreur classique est de raisonner à la prestation. Raisonnez à l&apos;heure. Une
          prestation à 35 € qui vous prend deux heures avec le trajet vous rapporte moins qu&apos;une
          prestation à 25 € bouclée en quarante minutes chez un client au coin de la rue.
        </P>
        <P>
          Chronométrez-vous sur vos dix prochaines prestations, trajet compris. La plupart des
          laveurs découvrent qu&apos;ils passent 20 à 30 % de temps de plus que ce qu&apos;ils
          croient — le temps d&apos;installation, le remplissage, le rangement, l&apos;échange avec
          le client à la fin.
        </P>

        <H2>Ce que votre prix doit couvrir</H2>
        <P>
          Un tarif viable couvre bien plus que votre salaire. Sur chaque prestation, vous financez :
        </P>
        <UL>
          <li><strong>Votre temps</strong>{' '}de travail effectif, plus le trajet aller-retour.</li>
          <li><strong>Les consommables</strong>{' '}: produits, microfibres, eau, essence.</li>
          <li><strong>L&apos;amortissement du matériel</strong>{' '}: un nettoyeur, un aspirateur et une cuve s&apos;usent et se remplacent.</li>
          <li><strong>Vos cotisations sociales</strong>{' '}: en micro-entreprise, comptez environ 21 à 22 % du chiffre d&apos;affaires pour une prestation de services.</li>
          <li><strong>Vos charges fixes</strong>{' '}: assurance, téléphone, éventuel abonnement logiciel.</li>
          <li><strong>Le temps non facturé</strong>{' '}: devis, réponses aux messages, comptabilité, trous dans le planning.</li>
        </UL>
        <P>
          Ce dernier point est celui qu&apos;on oublie systématiquement. Vous ne facturez jamais
          huit heures sur une journée de huit heures — nous avons chiffré ce que ça donne en
          revenu réel dans{' '}
          <A href="/blog/combien-gagne-un-laveur-auto-mobile">combien gagne un laveur auto mobile</A>.
           Si vous facturez cinq heures sur huit, votre
          taux horaire facturé doit être calculé sur cette base — pas sur un planning idéal.
        </P>

        <Callout>
          <p>
            <strong>Le calcul en une ligne.</strong>{' '}Prenez le revenu mensuel que vous visez,
            ajoutez vos charges et vos cotisations, divisez par le nombre d&apos;heures que vous
            pensez réellement facturer dans le mois. Vous obtenez votre taux horaire plancher.
            Tout tarif qui passe en dessous vous fait travailler à perte, même s&apos;il remplit
            l&apos;agenda.
          </p>
        </Callout>

        <H2>Une grille indicative</H2>
        <P>
          Les fourchettes ci-dessous correspondent à ce qui se pratique couramment en France sur du
          lavage à domicile pour un véhicule citadine ou berline. Elles varient fortement selon la
          région : comptez plus en zone urbaine dense, moins en zone rurale.
        </P>

        <Table
          head={['Prestation', 'Durée', 'Fourchette']}
          rows={[
            ['Lavage extérieur', '40 – 60 min', '25 – 45 €'],
            ['Lavage intérieur', '60 – 90 min', '35 – 60 €'],
            ['Lavage complet (int. + ext.)', '1 h 30 – 2 h 30', '55 – 95 €'],
            ['Nettoyage en profondeur', '3 – 5 h', '120 – 250 €'],
            ['Rénovation de sièges', '1 – 2 h', '60 – 120 €'],
            ['Traitement céramique', '4 – 8 h', '250 – 700 €'],
          ]}
        />

        <P>
          Majorez pour les SUV, monospaces et utilitaires : ils demandent souvent 30 à 50 % de temps
          en plus. Prévoir un tarif unique pour tous les gabarits, c&apos;est se faire rattraper par
          les grands véhicules et perdre de l&apos;argent sur chacun.
        </P>

        <H2>Facturez le déplacement, ou intégrez-le</H2>
        <P>
          Deux approches valables, une seule erreur possible : ne rien prévoir du tout.
        </P>
        <UL>
          <li>
            <strong>Zone incluse.</strong>{' '}Vous définissez un rayon autour de votre point de
            départ et le déplacement est compris dedans. Simple pour le client, lisible, et ça vous
            pousse à travailler concentré géographiquement.
          </li>
          <li>
            <strong>Frais au-delà.</strong>{' '}Passé cette zone, un supplément fixe ou au kilomètre.
            Ça vous évite de refuser un bon client un peu excentré tout en couvrant le trajet.
          </li>
        </UL>
        <P>
          Ce qui coûte cher, ce n&apos;est pas le carburant, c&apos;est le temps. Quarante-cinq
          minutes de route, c&apos;est une prestation en moins dans la journée. C&apos;est aussi
          pour ça que{' '}
          <A href="/blog/organiser-ses-tournees-lavage-auto">grouper ses rendez-vous par secteur</A>{' '}
          pèse davantage sur votre revenu que n&apos;importe quel ajustement de prix.
        </P>

        <H2>Les erreurs qui plombent une marge</H2>
        <UL>
          <li>
            <strong>S&apos;aligner sur le lavage automatique.</strong>{' '}Vous ne vendez pas la même
            chose. Un client qui vous choisit pour le prix vous quittera pour le prix.
          </li>
          <li>
            <strong>La remise systématique.</strong>{' '}Accorder dix euros à chaque hésitation
            apprend à vos clients à négocier, et détruit votre grille en quelques mois.
          </li>
          <li>
            <strong>Ne jamais augmenter.</strong>{' '}Vos produits, votre carburant et vos cotisations
            augmentent. Une révision annuelle, même de 5 %, est normale — vos clients fidèles ne
            partiront pas pour ça.
          </li>
          <li>
            <strong>Facturer le nettoyage en profondeur au prix d&apos;un lavage.</strong>{' '}Un
            intérieur très encrassé, des poils d&apos;animaux ou des taches incrustées, c&apos;est
            plusieurs heures. Prévoyez un supplément et annoncez-le avant, pas après.
          </li>
        </UL>

        <H2>Comment savoir si vos prix sont justes</H2>
        <P>
          Deux signaux valent tous les tableaux. Si <strong>personne</strong>{' '}ne trouve jamais
          vos tarifs élevés, ils sont trop bas. Si votre agenda est plein trois semaines à
          l&apos;avance et que vous refusez du monde, vous pouvez augmenter sans crainte : la
          demande dépasse votre capacité, c&apos;est exactement le moment.
        </P>
        <P>
          À l&apos;inverse, un agenda vide n&apos;est pas forcément un problème de prix. Avant de
          baisser, vérifiez d&apos;où viennent vos clients : bien souvent le vrai frein est la{' '}
          <A href="/blog/trouver-des-clients-laveur-auto-mobile">visibilité</A>, pas le tarif. Baisser ses prix pour compenser un manque de clients revient à
          travailler plus pour gagner autant.
        </P>

        <Faq items={faq} />

        <Cta title="Savoir ce que vous gagnez vraiment">
          WashBoard suit votre chiffre d&apos;affaires par prestation, calcule automatiquement les
          frais de déplacement selon la distance, et vous montre ce que rapporte réellement chaque
          journée. Plus besoin d&apos;estimer à la fin du mois.
        </Cta>

        <AlsoRead
          items={[
            { href: '/blog/combien-gagne-un-laveur-auto-mobile', label: 'Combien gagne un laveur auto mobile ? Revenus réels et simulation' },
            { href: '/blog/trouver-des-clients-laveur-auto-mobile', label: 'Comment trouver des clients quand on est laveur auto mobile' },
            { href: '/blog/organiser-ses-tournees-lavage-auto', label: 'Organiser ses tournées pour laver plus de voitures par jour' },
            { href: '/blog/devenir-laveur-auto-mobile', label: 'Devenir laveur auto mobile : par où commencer' },
          ]}
        />
      </article>
    </>
  )
}

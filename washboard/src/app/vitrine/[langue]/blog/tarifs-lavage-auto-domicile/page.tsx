import type { Metadata } from 'next'
import { getArticle, SITE_URL } from '@/lib/blog'
import { lienPageMetierTraduit } from '@/lib/metiers'
import { requiredPlanLabel } from '@/lib/plan'
import { H2, P, UL, A, Callout, Table, Summary, Faq, ArticleHeader, Cta, AlsoRead, ArticleJsonLd, type FaqItem } from '@/components/blog/Prose'
import { getTArticle as getT } from '@/lib/i18n/serveur'
import { imagePartage } from '@/lib/imagePartage'
import { alt as altImage } from '@/app/blog/tarifs-lavage-auto-domicile/opengraph-image'

const article = getArticle('tarifs-lavage-auto-domicile')!
const url = `${SITE_URL}/blog/${article.slug}`

export const metadata: Metadata = {
  title: `${article.title} | WashBoard`,
  description: article.description,
  alternates: { canonical: url },
  openGraph: {
    images: imagePartage('/blog/tarifs-lavage-auto-domicile', altImage),
    type: 'article',
    url,
    title: article.title,
    description: article.description,
    publishedTime: article.publishedAt,
    modifiedTime: article.updatedAt,
    authors: ['WashBoard'],
    section: 'Tarifs',
  },
  twitter: { images: imagePartage('/blog/tarifs-lavage-auto-domicile', altImage), card: 'summary_large_image', title: article.title, description: article.description },
}


export default async function Page() {
  const t = await getT()
  const faq: FaqItem[] = [
    {
      question: t('Quel est le prix moyen d’un lavage auto à domicile ?'),
      answer:
        t('En France, un lavage extérieur à domicile se facture généralement entre 45 et 65 €, un intérieur entre 55 et 80 €, et un lavage complet entre 75 et 115 € pour une citadine ou une berline. Un nettoyage en profondeur (plusieurs heures) va de 140 à 270 €. Comptez 30 à 50 % de plus pour un SUV, un monospace ou un utilitaire.'),
    },
    {
      question: t('Combien facturer de l’heure en lavage auto mobile ?'),
      answer:
        t('Partez du revenu mensuel visé, ajoutez vos charges et vos cotisations (environ 21 à 22 % du chiffre d’affaires en micro-entreprise pour une prestation de services), puis divisez par le nombre d’heures réellement facturées dans le mois — pas par les heures travaillées. Le résultat est votre taux horaire plancher ; en pratique il se situe rarement en dessous de 35 à 45 € de l’heure.'),
    },
    {
      question: t('Faut-il facturer les frais de déplacement pour un lavage à domicile ?'),
      answer:
        t('Oui, d’une manière ou d’une autre. Soit vous définissez une zone dans laquelle le déplacement est inclus dans le prix, soit vous ajoutez un supplément fixe ou au kilomètre au-delà. La seule erreur est de ne rien prévoir : ce qui coûte cher n’est pas le carburant mais le temps de route, qui remplace une prestation.'),
    },
    {
      question: t('Quand augmenter ses tarifs de lavage auto ?'),
      answer:
        t('Quand votre agenda est plein trois semaines à l’avance et que vous refusez des clients : la demande dépasse votre capacité. Une révision annuelle de l’ordre de 5 % est par ailleurs normale pour suivre le coût des produits, du carburant et des cotisations ; vos clients fidèles ne partiront pas pour ça.'),
    },
  ]

  return (
    <>
      <ArticleJsonLd article={article} siteUrl={SITE_URL} faq={faq} />
      <article>
        <ArticleHeader
          article={article}
          intro={t('La plupart des laveurs qui démarrent fixent leurs prix en regardant ceux du voisin, puis retirent cinq euros. C\'est le meilleur moyen de travailler beaucoup pour gagner peu. Voici comment calculer un tarif qui tient.')}
        />

        <Summary
          items={[
            t('Raisonnez à l’heure facturée, pas à la prestation : chronométrez-vous trajet compris sur dix prestations.'),
            t('Votre prix couvre votre temps, les consommables, l’amortissement du matériel, vos cotisations (≈ 21–22 % en micro-entreprise) et le temps non facturé.'),
            t('Fourchettes courantes en France : 45–65 € l’extérieur, 55–80 € l’intérieur, 75–115 € le complet, +30 à 50 % pour SUV et utilitaires.'),
            t('Prévoyez le déplacement : zone incluse ou supplément au-delà, mais jamais rien.'),
            t('Agenda plein trois semaines à l’avance = le moment d’augmenter.'),
          ]}
        />

        <P>
          {t('Le lavage auto à domicile se vend cher parce qu’il vend du temps gagné, pas du nettoyage. Le client ne compare pas votre prix à celui du rouleau de la station : il le compare aux quarante minutes qu’il ne passera pas à faire la queue un samedi après-midi. Vos tarifs doivent refléter ce service, pas le prix d’un lavage automatique.')}
        </P>

        <H2>{t('Commencez par le temps réel, pas par le prix')}</H2>
        <P>
          {t('L’erreur classique est de raisonner à la prestation. Raisonnez à l’heure. Une prestation à 55 € qui vous prend deux heures avec le trajet vous rapporte moins qu’une prestation à 45 € bouclée en quarante minutes chez un client au coin de la rue.')}
        </P>
        <P>
          {t('Chronométrez-vous sur vos dix prochaines prestations, trajet compris. La plupart des laveurs découvrent qu’ils passent 20 à 30 % de temps de plus que ce qu’ils croient — le temps d’installation, le remplissage, le rangement, l’échange avec le client à la fin.')}
        </P>

        <H2>{t('Ce que votre prix doit couvrir')}</H2>
        <P>
          {t('Un tarif viable couvre bien plus que votre salaire. Sur chaque prestation, vous financez :')}
        </P>
        <UL>
          <li><strong>{t('Votre temps')}</strong>{' '}{t('de travail effectif, plus le trajet aller-retour.')}</li>
          <li><strong>{t('Les consommables')}</strong>{' '}{t(': produits, microfibres, eau, essence.')}</li>
          <li><strong>{t('L’amortissement du matériel')}</strong>{' '}{t(': un nettoyeur, un aspirateur et une cuve s’usent et se remplacent.')}</li>
          <li><strong>{t('Vos cotisations sociales')}</strong>{' '}{t(': en micro-entreprise, comptez environ 21 à 22 % du chiffre d’affaires pour une prestation de services.')}</li>
          <li><strong>{t('Vos charges fixes')}</strong>{' '}{t(': assurance, téléphone, éventuel abonnement logiciel.')}</li>
          <li><strong>{t('Le temps non facturé')}</strong>{' '}{t(': devis, réponses aux messages, comptabilité, trous dans le planning.')}</li>
        </UL>
        <P>
          {t('Ce dernier point est celui qu’on oublie systématiquement. Vous ne facturez jamais huit heures sur une journée de huit heures — nous avons chiffré ce que ça donne en revenu réel dans')}{' '}
          <A href="/blog/combien-gagne-un-laveur-auto-mobile">{t('combien gagne un laveur auto mobile')}</A>{t('. Si vous facturez cinq heures sur huit, votre taux horaire facturé doit être calculé sur cette base — pas sur un planning idéal.')}
        </P>

        <Callout>
          <p>
            <strong>{t('Le calcul en une ligne.')}</strong>{' '}{t('Prenez le revenu mensuel que vous visez, ajoutez vos charges et vos cotisations, divisez par le nombre d’heures que vous pensez réellement facturer dans le mois. Vous obtenez votre taux horaire plancher. Tout tarif qui passe en dessous vous fait travailler à perte, même s’il remplit l’agenda.')}
          </p>
        </Callout>

        <H2>{t('Une grille indicative')}</H2>
        <P>
          {t('Les fourchettes ci-dessous correspondent à ce qui se pratique couramment en France sur du lavage à domicile pour un véhicule citadine ou berline. Elles varient fortement selon la région : comptez plus en zone urbaine dense, moins en zone rurale.')}
        </P>

        <Table
          head={[t('Prestation'), t('Durée'), t('Fourchette')]}
          rows={[
            [t('Lavage extérieur'), t('40 – 60 min'), '45 – 65 €'],
            [t('Lavage intérieur'), t('60 – 90 min'), '55 – 80 €'],
            [t('Lavage complet (int. + ext.)'), '1 h 30 – 2 h 30', '75 – 115 €'],
            [t('Nettoyage en profondeur'), '3 – 5 h', '140 – 270 €'],
            [t('Rénovation de sièges'), '1 – 2 h', '80 – 140 €'],
            [t('Traitement céramique'), '4 – 8 h', '270 – 720 €'],
          ]}
        />

        <P>
          {t('Majorez pour les SUV, monospaces et utilitaires : ils demandent souvent 30 à 50 % de temps en plus. Prévoir un tarif unique pour tous les gabarits, c’est se faire rattraper par les grands véhicules et perdre de l’argent sur chacun.')}
        </P>

        <H2>{t('Facturez le déplacement, ou intégrez-le')}</H2>
        <P>
          {t('Deux approches valables, une seule erreur possible : ne rien prévoir du tout.')}
        </P>
        <UL>
          <li>
            <strong>{t('Zone incluse.')}</strong>{' '}{t('Vous définissez un rayon autour de votre point de départ et le déplacement est compris dedans. Simple pour le client, lisible, et ça vous pousse à travailler concentré géographiquement.')}
          </li>
          <li>
            <strong>{t('Frais au-delà.')}</strong>{' '}{t('Passé cette zone, un supplément fixe ou au kilomètre. Ça vous évite de refuser un bon client un peu excentré tout en couvrant le trajet.')}
          </li>
        </UL>
        <P>
          {t('Ce qui coûte cher, ce n’est pas le carburant, c’est le temps. Quarante-cinq minutes de route, c’est une prestation en moins dans la journée. C’est aussi pour ça que')}{' '}
          <A href="/blog/organiser-ses-tournees-lavage-auto">{t('grouper ses rendez-vous par secteur')}</A>{' '}
          {t('pèse davantage sur votre revenu que n’importe quel ajustement de prix.')}
        </P>

        <H2>{t('Les erreurs qui plombent une marge')}</H2>
        <UL>
          <li>
            <strong>{t('S’aligner sur le lavage automatique.')}</strong>{' '}{t('Vous ne vendez pas la même chose. Un client qui vous choisit pour le prix vous quittera pour le prix.')}
          </li>
          <li>
            <strong>{t('La remise systématique.')}</strong>{' '}{t('Accorder dix euros à chaque hésitation apprend à vos clients à négocier, et détruit votre grille en quelques mois. Une promotion datée, avec un début et une fin annoncés, est tout autre chose : elle crée l’urgence au lieu d’installer une habitude.')}
          </li>
          <li>
            <strong>{t('Ne jamais augmenter.')}</strong>{' '}{t('Vos produits, votre carburant et vos cotisations augmentent. Une révision annuelle, même de 5 %, est normale — vos clients fidèles ne partiront pas pour ça.')}
          </li>
          <li>
            <strong>{t('Facturer le nettoyage en profondeur au prix d’un lavage.')}</strong>{' '}{t('Un intérieur très encrassé, des poils d’animaux ou des taches incrustées, c’est plusieurs heures. Prévoyez un supplément et annoncez-le avant, pas après.')}
          </li>
        </UL>

        <H2>{t('Comment savoir si vos prix sont justes')}</H2>
        <P>
          {t('Deux signaux valent tous les tableaux. Si')} <strong>{t('personne')}</strong>{' '}{t('ne trouve jamais vos tarifs élevés, ils sont trop bas. Si votre agenda est plein trois semaines à l’avance et que vous refusez du monde, vous pouvez augmenter sans crainte : la demande dépasse votre capacité, c’est exactement le moment.')}
        </P>
        <P>
          {t('À l’inverse, un agenda vide n’est pas forcément un problème de prix. Avant de baisser, vérifiez d’où viennent vos clients : bien souvent le vrai frein est la')}{' '}
          <A href="/blog/trouver-des-clients-laveur-auto-mobile">{t('visibilité')}</A>{t(', pas le tarif. Baisser ses prix pour compenser un manque de clients revient à travailler plus pour gagner autant.')}
        </P>

        <Faq items={faq} />

        <Cta
          title={t('Savoir ce que vous gagnez vraiment')}
          secondary={lienPageMetierTraduit(t, article.theme)}
        >
          {t('WashBoard calcule automatiquement les frais de déplacement selon le temps de trajet ou la distance réels, vous laisse lancer une promotion datée, avec bandeau et compte à rebours, plutôt qu’une remise permanente, et suit vos recettes et vos dépenses mois par mois (dès la formule')}{' '}
          {requiredPlanLabel('compta')}{t('). Plus besoin d’estimer à la fin du mois.')}
        </Cta>

        <AlsoRead
          items={[
            { href: '/blog/combien-gagne-un-laveur-auto-mobile', label: t('Combien gagne un laveur auto mobile ? Revenus réels et simulation') },
            { href: '/blog/trouver-des-clients-laveur-auto-mobile', label: t('Comment trouver des clients quand on est laveur auto mobile') },
            { href: '/blog/organiser-ses-tournees-lavage-auto', label: t('Organiser ses tournées pour laver plus de voitures par jour') },
            { href: '/blog/devenir-laveur-auto-mobile', label: t('Devenir laveur auto mobile : par où commencer') },
          ]}
        />
      </article>
    </>
  )
}

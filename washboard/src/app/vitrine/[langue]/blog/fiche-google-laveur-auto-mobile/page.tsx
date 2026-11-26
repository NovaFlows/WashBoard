import type { Metadata } from 'next'
import { getArticle, SITE_URL } from '@/lib/blog'
import { lienPageMetierTraduit } from '@/lib/metiers'
import { requiredPlanLabel } from '@/lib/plan'
import { H2, H3, P, UL, A, Callout, Table, Summary, Faq, ArticleHeader, Cta, AlsoRead, ArticleJsonLd, type FaqItem } from '@/components/blog/Prose'
import { getTArticle as getT } from '@/lib/i18n/serveur'
import { imagePartage } from '@/lib/imagePartage'
import { alt as altImage } from '@/app/blog/fiche-google-laveur-auto-mobile/opengraph-image'

const article = getArticle('fiche-google-laveur-auto-mobile')!
const url = `${SITE_URL}/blog/${article.slug}`

export const metadata: Metadata = {
  title: `${article.title} | WashBoard`,
  description: article.description,
  alternates: { canonical: url },
  openGraph: {
    images: imagePartage('/blog/fiche-google-laveur-auto-mobile', altImage),
    type: 'article',
    url,
    title: article.title,
    description: article.description,
    publishedTime: article.publishedAt,
    modifiedTime: article.updatedAt,
    authors: ['WashBoard'],
    section: 'Trouver des clients',
  },
  twitter: {
    images: imagePartage('/blog/fiche-google-laveur-auto-mobile', altImage),
    card: 'summary_large_image',
    title: article.title,
    description: article.description,
  },
}


export default async function Page() {
  const t = await getT()
  const faq: FaqItem[] = [
    {
      question: t('Un laveur auto mobile peut-il avoir une fiche Google sans local ?'),
      answer:
        t('Oui. Google prévoit les « entreprises de services à domicile » : à la création de la fiche, indiquez que vous vous déplacez chez les clients, masquez votre adresse et définissez une zone de service (communes ou rayon). Votre fiche apparaît alors dans les recherches locales de toute la zone, sans afficher votre domicile.'),
    },
    {
      question: t('Quelle catégorie choisir pour une fiche Google de lavage auto ?'),
      answer:
        t('Catégorie principale « Service de lavage de voitures » (ou « Station de lavage » si l’autre n’est pas proposée), avec en catégories secondaires « Service de nettoyage automobile » et « Detailing automobile » si vous proposez ces prestations. La catégorie principale pèse le plus dans le classement : ne la changez pas tous les mois.'),
    },
    {
      question: t('Combien d’avis Google faut-il pour être visible ?'),
      answer:
        t('Il n’y a pas de seuil officiel, mais en pratique une fiche passe un cap autour de 10 avis récents et un autre vers 30 à 50. Ce qui compte autant que le nombre : la régularité (un avis par semaine vaut mieux que vingt d’un coup) et la note moyenne au-dessus de 4,5.'),
    },
    {
      question: t('Combien de temps avant qu’une fiche Google amène des clients ?'),
      answer:
        t('Comptez quatre à huit semaines après la validation pour que la fiche commence à apparaître dans le bloc carte, et deux à trois mois pour qu’elle amène des appels réguliers — à condition d’ajouter des photos et de recevoir des avis pendant cette période. Une fiche créée puis laissée vide ne décolle jamais.'),
    },
    {
      question: t('Comment répondre à un avis négatif sur sa fiche Google ?'),
      answer:
        t('Vite, poliment, factuellement, sans se justifier sur trois paragraphes : remerciez, reconnaissez le point, proposez une solution en privé. La réponse est lue par les futurs clients, pas seulement par l’auteur de l’avis. Une réponse calme à un avis injuste rassure plus qu’une fiche sans aucune critique.'),
    },
  ]

  return (
    <>
      <ArticleJsonLd article={article} siteUrl={SITE_URL} faq={faq} />
      <article>
        <ArticleHeader
          article={article}
          intro={t('Quand quelqu\'un tape « lavage voiture à domicile » et le nom de sa ville, Google affiche trois fiches sur une carte avant tout le reste. Y être, c\'est recevoir des appels de gens qui veulent réserver maintenant. Voici comment configurer la vôtre pour y arriver — même sans local.')}
        />

        <Summary
          items={[
            t('Déclarez-vous comme entreprise de services à domicile : adresse masquée, zone de service définie par communes ou rayon.'),
            t('Catégorie principale « Service de lavage de voitures », description avec vos prestations et vos villes, horaires réellement tenus.'),
            t('Photos de vos propres prestations (avant/après, au téléphone) : c’est ce que les gens regardent en premier.'),
            t('Un avis par semaine, demandé le jour même par message avec le lien direct, vaut mieux que vingt d’un coup.'),
            t('Répondez à chaque avis et publiez un post par mois : Google favorise les fiches actives.'),
          ]}
        />

        <P>
          {t('La fiche d’établissement Google (ex-Google My Business) est gratuite, et c’est le canal qui amène le plus de clients aux laveurs mobiles — loin devant Instagram ou les flyers. Nous l’expliquons dans')}{' '}
          <A href="/blog/trouver-des-clients-laveur-auto-mobile">{t('notre guide des canaux qui marchent')}</A>{t('. Pourtant la plupart des fiches de laveurs sont mal configurées : adresse personnelle affichée, aucune photo, trois avis datant de la création. Cet article prend les réglages un par un.')}
        </P>

        <H2>{t('1. Se déclarer comme entreprise à domicile')}</H2>
        <P>
          {t('C’est le point qui bloque les laveurs mobiles : « je n’ai pas de local, donc pas de fiche ». Faux. Google prévoit ce cas. À la création, quand la question « Souhaitez- vous ajouter un lieu que les clients peuvent visiter ? » apparaît, répondez non, puis indiquez que vous vous déplacez chez vos clients.')}
        </P>
        <P>{t('Vous définissez ensuite une')} <strong>{t('zone de service')}</strong> :</P>
        <UL>
          <li>
            <strong>{t('Par communes')}</strong>{' '}{t(': listez les villes que vous couvrez réellement. Google en accepte une vingtaine.')}
          </li>
          <li>
            <strong>{t('Par rayon')}</strong>{' '}{t('n’existe plus comme option directe ; choisissez les communes situées dans la zone que vous avez définie pour vos')}{' '}
            <A href="/blog/tarifs-lavage-auto-domicile">{t('frais de déplacement')}</A>.
          </li>
        </UL>
        <Callout>
          <p>
            <strong>{t('Ne trichez pas sur la zone.')}</strong>{' '}{t('Déclarer tout le département pour « ratisser large » ne vous fera pas remonter davantage : Google classe les fiches par proximité réelle avec la personne qui cherche. Vous recevrez surtout des appels de gens trop loin, que vous refuserez.')}
          </p>
        </Callout>

        <H2>{t('2. Les réglages qui pèsent dans le classement')}</H2>
        <H3>{t('La catégorie')}</H3>
        <P>
          {t('Catégorie principale :')} <strong>{t('Service de lavage de voitures')}</strong>{t('. C’est celle que Google associe aux recherches « lavage voiture », « nettoyage auto », « laveur auto ». En secondaires, ajoutez « Service de nettoyage automobile » et, si vous le proposez, « Detailing automobile ». Évitez « Station de lavage » en principal : elle renvoie vers les rouleaux.')}
        </P>
        <H3>{t('Le nom')}</H3>
        <P>
          {t('Le nom de votre entreprise, tel qu’il est enregistré — pas « Lavage auto domicile Bordeaux pas cher ». Google suspend les fiches dont le nom est bourré de mots-clés, et les clients ne s’y trompent pas non plus.')}
        </P>
        <H3>{t('La description')}</H3>
        <P>
          {t('750 caractères pour dire ce que vous faites, où, et comment on réserve. Nommez vos prestations (extérieur, intérieur, complet, rénovation), votre méthode si elle est un argument (')}<A href="/blog/lavage-auto-sans-eau">{t('sans eau')}</A>{t(', intervention sur parking d’entreprise), et deux ou trois villes principales. Terminez par la façon de réserver : lien, téléphone, ou les deux.')}
        </P>
        <H3>{t('Les horaires')}</H3>
        <P>
          {t('Ceux auxquels vous répondez, pas ceux auxquels vous travaillez. Une fiche « ouverte » le dimanche où personne ne décroche produit des avis « ne répond pas ». Si vous travaillez le samedi mais ne prenez pas d’appels, indiquez-le dans la description.')}
        </P>
        <H3>{t('Le lien de réservation')}</H3>
        <P>
          {t('Google affiche un bouton « Réserver » sur les fiches qui ont un lien de prise de rendez-vous. C’est le réglage qui transforme le plus : la personne qui cherche à 21 h réserve seule au lieu de vous laisser un message auquel vous répondrez le lendemain. Mettez-y votre page de réservation, pas votre page d’accueil.')}
        </P>

        <H2>{t('3. Les photos : ce que les gens regardent en premier')}</H2>
        <P>
          {t('Avant de lire un seul avis, le visiteur fait défiler les photos. Une fiche sans photo, ou avec un logo et une image de banque, est perçue comme inactive. Ce qu’il faut :')}
        </P>
        <UL>
          <li>
            <strong>{t('Des avant/après de vraies voitures')}</strong>{t(', prises au téléphone, en lumière naturelle. Le sale à gauche, le propre à droite, même angle. C’est votre meilleur argument de vente et il ne coûte rien.')}
          </li>
          <li>
            <strong>{t('Vous au travail')}</strong>{t(', sur un parking, avec votre matériel. Les gens font venir quelqu’un chez eux : ils veulent voir qui.')}
          </li>
          <li>
            <strong>{t('Une photo par semaine')}</strong>{' '}{t('plutôt que trente d’un coup. Google note la régularité, et la fiche reste vivante.')}
          </li>
        </UL>
        <P>
          {t('Demandez au client l’autorisation avant de publier une photo où la plaque est lisible, ou floutez-la. C’est une question de correction plus que de droit, mais un client qui retrouve sa voiture sur Internet sans avoir été prévenu ne reviendra pas.')}
        </P>

        <H2>{t('4. Les avis : la seule chose que vos concurrents ne peuvent pas copier')}</H2>
        <P>
          {t('Entre deux fiches à catégorie et photos égales, celle qui a le plus d’avis récents passe devant. Et une fois devant, elle transforme mieux : 4,8 sur 40 avis rassure, 5 sur 3 avis interroge.')}
        </P>
        <Table
          head={[t('Ce qui marche'), t('Ce qui ne marche pas')]}
          rows={[
            [t('Demander le jour même, par SMS ou email, avec le lien direct'), t('Demander de vive voix sur le pas de la porte')],
            [t('Un message court et personnel (« merci pour aujourd’hui… »)'), t('Un modèle générique visiblement automatisé sans prénom')],
            [t('Un avis par semaine, régulièrement'), t('Vingt avis la même semaine (signal d’achat pour Google)')],
            [t('Répondre à chaque avis, positif ou négatif, sous 48 h'), t('Ne répondre qu’aux négatifs, ou pas du tout')],
            [t('Accepter les avis courts : « super boulot » suffit'), t('Dicter au client ce qu’il doit écrire')],
          ]}
        />
        <P>
          {t('Le lien direct se récupère depuis votre fiche : « Demander des avis » vous donne une adresse courte qui ouvre la fenêtre de notation sans étape intermédiaire. Chaque clic supplémentaire fait perdre la moitié des gens.')}
        </P>
        <Callout>
          <p>
            <strong>{t('N’achetez jamais d’avis')}</strong>{t(', et ne demandez pas à vos proches d’en laisser. Google détecte les avis groupés, sans historique de recherche local ou sans prestation associée, et peut suspendre la fiche entière — c’est-à-dire votre premier canal de clients.')}
          </p>
        </Callout>

        <H2>{t('5. Garder la fiche vivante')}</H2>
        <P>
          {t('Google favorise les fiches qui bougent. Ça ne demande pas d’être community manager :')}
        </P>
        <UL>
          <li>
            <strong>{t('Un post par mois')}</strong>{' '}{t(': une photo avant/après avec deux lignes, une disponibilité (« créneaux libres jeudi sur Mérignac »), une nouvelle prestation.')}
          </li>
          <li>
            <strong>{t('La section Questions/Réponses')}</strong>{' '}{t(': posez vous-même les trois questions que vos clients vous posent toujours (zone, prix, durée) et répondez-y. Sinon, ce sont des inconnus qui répondront à votre place.')}
          </li>
          <li>
            <strong>{t('Les messages')}</strong>{' '}{t(': si vous activez la messagerie, répondez dans l’heure ou désactivez-la. Google affiche votre temps de réponse.')}
          </li>
        </UL>

        <H2>{t('Ce que vous devez voir au bout de trois mois')}</H2>
        <P>
          {t('L’onglet Statistiques de la fiche vous dit combien de personnes l’ont vue, ont appelé, ont cliqué sur le site ou demandé l’itinéraire. Trois signaux à surveiller :')}
        </P>
        <UL>
          <li>{t('Les recherches « découverte » (les gens qui ont tapé « lavage auto » sans vous connaître) doivent dépasser les recherches directes par votre nom.')}</li>
          <li>{t('Les appels et clics sur « Réserver » doivent augmenter d’un mois sur l’autre.')}</li>
          <li>{t('Les requêtes qui affichent votre fiche doivent contenir vos villes cibles — sinon revoyez la zone et la description.')}</li>
        </UL>
        <P>
          {t('Si au bout de trois mois rien ne bouge, dans 90 % des cas c’est l’absence d’avis ou de photos, pas un problème de réglage. Reprenez le point 3 et le point 4.')}
        </P>

        <Faq items={faq} />

        <Cta
          title={t('Un bouton « Réserver » qui remplit l\'agenda')}
          secondary={lienPageMetierTraduit(t, article.theme)}
        >
          {t('WashBoard vous donne un lien de réservation à votre nom, à mettre sur votre fiche Google. Le client choisit son créneau et renseigne son véhicule, vous recevez la demande, et la demande d’avis part automatiquement après la prestation (à partir de la formule')}{' '}
          {requiredPlanLabel('avis_email')}).
        </Cta>

        <AlsoRead
          items={[
            { href: '/blog/trouver-des-clients-laveur-auto-mobile', label: t('Comment trouver des clients quand on est laveur auto mobile') },
            { href: '/blog/lavage-auto-sans-eau', label: t('Lavage auto sans eau : comment ça marche, pour qui, avec quoi') },
            { href: '/blog/combien-gagne-un-laveur-auto-mobile', label: t('Combien gagne un laveur auto mobile ? Revenus réels et simulation') },
          ]}
        />
      </article>
    </>
  )
}

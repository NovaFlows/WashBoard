import type { Metadata } from 'next'
import { getArticle, SITE_URL } from '@/lib/blog'
import { lienPageMetierTraduit } from '@/lib/metiers'
import { H2, H3, P, UL, Callout, Table, Summary, Faq, ArticleHeader, Cta, AlsoRead, ArticleJsonLd, type FaqItem } from '@/components/blog/Prose'
import { getTArticle as getT } from '@/lib/i18n/serveur'
import { imagePartage } from '@/lib/imagePartage'
import { alt as altImage } from '@/app/blog/carte-de-fidelite-laveur-auto-mobile/opengraph-image'

const article = getArticle('carte-de-fidelite-laveur-auto-mobile')!
const url = `${SITE_URL}/blog/${article.slug}`

export const metadata: Metadata = {
  title: `${article.title} | WashBoard`,
  description: article.description,
  alternates: { canonical: url },
  openGraph: {
    images: imagePartage('/blog/carte-de-fidelite-laveur-auto-mobile', altImage),
    type: 'article',
    url,
    title: article.title,
    description: article.description,
    publishedTime: article.publishedAt,
    modifiedTime: article.updatedAt,
    authors: ['WashBoard'],
    section: 'Fidéliser',
  },
  twitter: { images: imagePartage('/blog/carte-de-fidelite-laveur-auto-mobile', altImage), card: 'summary_large_image', title: article.title, description: article.description },
}


export default async function Page() {
  const t = await getT()
  const faq: FaqItem[] = [
    {
      question: t('Une carte de fidélité est-elle utile pour un laveur auto à domicile ?'),
      answer:
        t('Oui, si votre clientèle revient. Un particulier fait laver sa voiture quelques fois par an : il oublie, ou il compare. Une carte lui donne une raison concrète de rappeler le même laveur plutôt que de chercher à nouveau. Elle sert moins à « récompenser » qu’à décider un client hésitant entre vous et un autre.'),
    },
    {
      question: t('Combien de tampons faut-il pour une récompense ?'),
      answer:
        t('Cinq à huit pour des particuliers, qui reviennent rarement : au-delà, la récompense est trop lointaine pour motiver. Dix à douze pour des clients réguliers ou des professionnels. Avec un tampon par véhicule, relevez ce nombre : une réservation de trois véhicules rapproche vite du seuil.'),
    },
    {
      question: t('Que coûte une prestation offerte à un laveur ?'),
      answer:
        t('Une prestation offerte tous les N tampons revient, à terme, à environ une prestation sur N non facturée, soit une remise de 1/N sur l’ensemble : 20 % à 5 tampons, 12,5 % à 8, 10 % à 10, environ 8 % à 12. Ce n’est pas du coût en matière — c’est du temps que vous ne facturez pas. À vous de choisir un seuil que votre marge supporte.'),
    },
    {
      question: t('Faut-il une application pour que le client suive sa carte ?'),
      answer:
        t('Non. Avec WashBoard, le client voit sa carte sur une page web personnelle, dont le lien est dans ses emails, et sur votre page de réservation dès qu’il a saisi ses coordonnées. Il reçoit un email à chaque tampon. Rien à installer, rien à imprimer.'),
    },
  ]

  return (
    <>
      <ArticleJsonLd article={article} siteUrl={SITE_URL} faq={faq} />
      <article>
        <ArticleHeader
          article={article}
          intro={t('Un client satisfait ne revient pas automatiquement : il oublie, ou il tape à nouveau « lavage auto à domicile » dans Google. Une carte de fidélité ne se juge pas à sa présentation mais à un calcul : combien de tampons, quelle récompense, et ce que ça vous coûte vraiment.')}
        />

        <Summary
          items={[
            t('Une carte de fidélité sert d’abord à départager vous et un concurrent le jour où le client doit se décider, pas à « remercier ».'),
            t('Une prestation offerte tous les N tampons revient à une remise d’environ 1/N : 20 % à 5 tampons, 10 % à 10. Calculez-le avant de choisir.'),
            t('Pour des particuliers qui lavent leur voiture quelques fois par an, restez entre 5 et 8 tampons : une récompense trop lointaine ne motive personne.'),
            t('Une carte que le client doit retrouver au fond d’un tiroir ne sert à rien : elle doit vivre dans son téléphone, sans qu’il ait rien à faire.'),
            t('Ce qui ne marche pas : trop de tampons, une récompense sans valeur perçue, et la fidélité utilisée pour masquer un travail moyen.'),
          ]}
        />

        <P>
          {t('Le lavage auto à domicile est un métier de répétition : une voiture se resalit, le client a besoin de vous à nouveau. Le problème, c’est le moment où il y repense. Entre deux prestations, rien ne vous relie à lui. Une carte de fidélité n’a qu’un travail : faire que ce moment-là, il pense à vous plutôt qu’à la première annonce venue.')}
        </P>

        <H2>{t('Pourquoi ça marche (et pourquoi ça rate souvent)')}</H2>
        <P>
          {t('Une carte fonctionne par un mécanisme simple, connu de n’importe qui : plus on a de tampons, plus on est tenté de finir la carte. Un client qui a déjà trois tampons sur dix a une raison de ne pas essayer un autre laveur : il perdrait son avance.')}
        </P>
        <P>
          {t('Elle rate quand la récompense est trop loin. Pour un particulier qui fait laver sa voiture quelques fois par an, une carte de dix tampons se remplit en plusieurs années. Personne ne joue un jeu dont la fin est si lointaine.')}
        </P>

        <H2>{t('Combien de tampons : faites le calcul avant de choisir')}</H2>
        <P>
          {t('Le piège d’une carte de fidélité, c’est de la fixer au feeling. Le nombre de tampons est une remise déguisée, et il se calcule. Si la récompense est une prestation offerte, et que cette prestation offerte compte elle-même comme un tampon, vous offrez à terme une prestation sur N :')}
        </P>
        <Table
          head={[t('Tampons pour une récompense'), t('Prestations offertes'), t('Équivalent d’une remise de')]}
          rows={[
            ['5', t('1 sur 5'), '20 %'],
            ['8', t('1 sur 8'), '12,5 %'],
            ['10', t('1 sur 10'), '10 %'],
            ['12', t('1 sur 12'), t('environ 8 %')],
          ]}
        />
        <P>
          {t('Ces pourcentages sont de l’arithmétique, pas une mesure : ils supposent un client qui va jusqu’au bout de la carte, et ne disent rien de ce que cela rapporte en clients qui reviennent. Ce qui compte, c’est de savoir ce que vous acceptez de perdre. Une remise de 10 % sur un client fidèle est un prix raisonnable pour le garder ; 20 % sur un client qui vient une fois par an, beaucoup moins.')}
        </P>
        <Callout>
          <p>
            <strong>{t('Particuliers : 5 à 8 tampons.')}</strong>{' '}{t('Clients réguliers ou professionnels : 10 à 12. Ce sont des repères de bon sens, pas des chiffres mesurés : testez, et si vos clients n’atteignent jamais la récompense, c’est que le seuil est trop haut.')}
          </p>
        </Callout>

        <H2>{t('Quelle récompense choisir')}</H2>
        <H3>{t('La prestation offerte')}</H3>
        <P>
          {t('C’est la plus parlante : « la dixième est offerte » se comprend en une seconde. Son coût réel est du temps, pas du matériel — une heure et demie de travail non facturée. Si vous l’offrez, décidez aussi du reste : les options sont-elles comprises ? Le déplacement ? Pour un client à vingt minutes de route, offrir le déplacement revient à payer pour travailler. Écrivez ces conditions (ce que couvre la récompense, sa durée de validité, et si les tampons expirent) et affichez-les là où le client voit sa carte : une récompense dont il découvre les limites après coup est une source de litige.')}
        </P>
        <H3>{t('La remise en pourcentage ou en euros')}</H3>
        <P>
          {t('Plus modeste, mais plus souple. Une remise de 20 % sur la prestation suivante laisse un prix de départ visible et ne coûte jamais une prestation entière. Une remise fixe en euros est lisible pour un client qui compare ses prix : « 15 € de moins » parle plus que « 15 % ». Dans les deux cas, pensez à ce que la remise couvre : sur la prestation et ses options, rarement sur le déplacement.')}
        </P>

        <H2>{t('Les clients professionnels : un tampon par véhicule')}</H2>
        <P>
          {t('Un garage ou une société avec plusieurs véhicules ne se fidélise pas comme un particulier. Si une réservation de trois véhicules ne donne qu’un seul tampon, la carte avance trois fois moins vite que son chiffre d’affaires. Compter un tampon par véhicule corrige cela — à condition de relever le nombre de tampons demandé : à dix tampons, un client qui fait laver trois véhicules à chaque passage a droit à sa récompense au bout de quatre visites.')}
        </P>

        <H2>{t('Carton ou carte numérique')}</H2>
        <Table
          head={['', t('Carton tamponné'), t('Carte numérique')]}
          rows={[
            [t('Coût'), t('Impression, encre, tampon'), t('Aucun matériel')],
            [t('Perte par le client'), t('Possible, et la carte repart à zéro'), t('Rare : elle suit le numéro de téléphone')],
            [t('Oubli du carton chez vous'), t('Pas de tampon ce jour-là'), t('Rien à apporter')],
            [t('Effort pour vous'), t('Penser à tamponner à chaque fois'), t('Aucun, si l’outil le fait à votre place')],
            [t('Effet « on y a pensé »'), t('Fort, le client le tient en main'), t('Faible, s’il ne la voit jamais')],
          ]}
        />
        <P>
          {t('Le carton a un vrai avantage : on le tient. Une carte numérique n’a de valeur que si le client la voit. Elle doit donc arriver à lui sans effort — un email à chaque tampon, un lien qu’il retrouve au moment de réserver — plutôt que d’attendre qu’il y pense.')}
        </P>

        <H2>{t('Ce qui ne marche pas')}</H2>
        <UL>
          <li>
            <strong>{t('Trop de tampons.')}</strong>{' '}{t('Une carte de vingt tampons pour un service dont on a besoin quelques fois par an, c’est une carte que personne ne finira.')}
          </li>
          <li>
            <strong>{t('Une récompense sans valeur perçue.')}</strong>{' '}{t('Par exemple, un petit lavage extérieur offert après dix prestations complètes ressemble à une pichenette. Offrez quelque chose que le client compare à ce qu’il a payé.')}
          </li>
          <li>
            <strong>{t('Faire de la carte un pansement.')}</strong>{' '}{t('Un client mal servi ne revient pas pour un tampon. La fidélité récompense un service déjà bon, elle ne le remplace pas.')}
          </li>
          <li>
            <strong>{t('Ne jamais en parler.')}</strong>{' '}{t('Une carte active que le client ne connaît pas n’a aucun effet. Mentionnez-la à la fin de la prestation, une phrase suffit.')}
          </li>
          <li>
            <strong>{t('Compter les prestations non faites.')}</strong>{' '}{t('Un tampon doit récompenser une prestation réellement réalisée, jamais une réservation. Une annulation ne compte pas.')}
          </li>
        </UL>

        <H2>{t('La mettre en place sans y passer du temps')}</H2>
        <P>
          {t('Le risque d’une carte de fidélité, c’est la charge qu’elle crée : penser à tamponner, tenir le compte, se rappeler qui a droit à quoi, appliquer la remise sans se tromper. C’est exactement le genre de tâche qu’on oublie en pleine journée de lavage. Que l’outil le fasse seul n’est pas un confort, c’est la condition pour que la carte tienne dans la durée.')}
        </P>

        <Faq items={faq} />

        <Cta
          title={t('Une carte de fidélité qui se tient toute seule')}
          secondary={lienPageMetierTraduit(t, article.theme)}
        >
          {t('Avec WashBoard, vous activez la carte, fixez le nombre de tampons et la récompense (prestation offerte, remise en % ou en €), et c’est tout : un tampon est ajouté quand vous marquez le rendez-vous « Terminé », le client reçoit un email « Votre tampon est arrivé », et la récompense s’applique toute seule à sa réservation suivante. Le client est reconnu par son numéro de téléphone. Les tampons arrivent par email uniquement, pas par SMS. La carte est incluse dès l’offre gratuite.')}
        </Cta>

        <AlsoRead
          items={[
            { href: '/blog/trouver-des-clients-laveur-auto-mobile', label: t('Comment trouver des clients quand on est laveur auto mobile') },
            { href: '/blog/acompte-reservation-laveur-auto-mobile', label: t('Acompte à la réservation pour un laveur auto mobile : sans perdre de clients') },
            { href: '/blog/tarifs-lavage-auto-domicile', label: t('Quels tarifs pratiquer en lavage auto à domicile') },
            { href: '/blog/combien-gagne-un-laveur-auto-mobile', label: t('Combien gagne un laveur auto mobile ? Revenus réels et simulation') },
          ]}
        />
      </article>
    </>
  )
}

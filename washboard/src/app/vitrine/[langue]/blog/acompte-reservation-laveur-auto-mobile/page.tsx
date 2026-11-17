import type { Metadata } from 'next'
import { getArticle, SITE_URL } from '@/lib/blog'
import { lienPageMetierTraduit } from '@/lib/metiers'
import { H2, H3, P, UL, Callout, Table, Summary, Faq, ArticleHeader, Cta, AlsoRead, ArticleJsonLd, type FaqItem } from '@/components/blog/Prose'
import { getTArticle as getT } from '@/lib/i18n/serveur'
import { imagePartage } from '@/lib/imagePartage'
import { alt as altImage } from '@/app/blog/acompte-reservation-laveur-auto-mobile/opengraph-image'

const article = getArticle('acompte-reservation-laveur-auto-mobile')!
const url = `${SITE_URL}/blog/${article.slug}`

export const metadata: Metadata = {
  title: `${article.title} | WashBoard`,
  description: article.description,
  alternates: { canonical: url },
  openGraph: {
    images: imagePartage('/blog/acompte-reservation-laveur-auto-mobile', altImage),
    type: 'article',
    url,
    title: article.title,
    description: article.description,
    publishedTime: article.publishedAt,
    modifiedTime: article.updatedAt,
    authors: ['WashBoard'],
    section: 'Organisation',
  },
  twitter: { images: imagePartage('/blog/acompte-reservation-laveur-auto-mobile', altImage), card: 'summary_large_image', title: article.title, description: article.description },
}


export default async function Page() {
  const t = await getT()
  const faq: FaqItem[] = [
    {
      question: t('Un laveur auto mobile peut-il demander un acompte ?'),
      answer:
        t('Oui, rien ne l’interdit : c’est une pratique courante dans les métiers qui se déplacent. Il faut en revanche l’annoncer avant la réservation, avec ses conditions (montant, délai pour payer, remboursement en cas d’annulation), et distinguer acompte et arrhes, qui n’engagent pas de la même façon. En cas de doute, faites relire vos conditions par un professionnel du droit.'),
    },
    {
      question: t('Quel montant d’acompte demander pour un lavage auto à domicile ?'),
      answer:
        t('Il n’y a pas de montant imposé. Le bon repère est ce que coûte un rendez-vous manqué : votre trajet et le créneau que vous n’avez pas pu replacer. Assez élevé pour que le client s’engage, assez bas pour ne pas lui faire préférer un concurrent qui ne demande rien. Une somme fixe est plus simple à payer qu’un pourcentage.'),
    },
    {
      question: t('Comment faire payer un acompte sans terminal de paiement ?'),
      answer:
        t('Avec un lien de paiement que vous créez vous-même : lien PayPal.me, lien de paiement Stripe ou SumUp, demande Lydia, ou simplement un virement ou un paiement Wero. Le client paie directement sur votre compte. Seul un lien PayPal.me accepte le montant dans son adresse ; avec les autres, le montant est fixé quand vous créez le lien.'),
    },
    {
      question: t('Que faire si le client ne paie pas son acompte ?'),
      answer:
        t('Fixez un délai dès le départ (quelques heures à deux jours selon la proximité du rendez-vous) et annoncez-le au client : passé ce délai, la réservation est annulée et le créneau est libéré. Relancer par message un client qui n’a pas payé, c’est précisément la corvée qu’un acompte devait vous éviter.'),
    },
  ]

  return (
    <>
      <ArticleJsonLd article={article} siteUrl={SITE_URL} faq={faq} />
      <article>
        <ArticleHeader
          article={article}
          intro={t('Un laveur mobile roule jusqu’à l’adresse, installe son matériel, et personne ne répond. Le créneau est perdu, le trajet aussi. Un acompte limite ce risque, mais mal posé il fait aussi fuir des clients. Voici comment le calibrer.')}
        />

        <Summary
          items={[
            t('Un rendez-vous manqué coûte le trajet et le créneau : sur une prestation à 60 € de 1 h 30 avec 30 minutes de route, c’est environ 80 € de manque à gagner si vous ne replacez pas la place.'),
            t('Acompte et arrhes ne se valent pas : ce que perd le client qui se dédit, et ce que doit rendre le laveur qui annule, n’est pas pareil. Avec un particulier, des sommes versées d’avance sont en principe présumées être des arrhes si vos conditions ne disent pas autre chose : écrivez noir sur blanc ce que vous demandez et ce qui se passe si l’un de vous deux annule.'),
            t('L’acompte doit être annoncé avant la réservation, avec ses conditions écrites.'),
            t('Le bon montant ne se devine pas : partez de ce que coûte un lapin, pas d’un pourcentage au hasard.'),
            t('Mal posé, un acompte fait fuir un client qui hésitait entre deux laveurs. Réservez-le aux prestations longues, aux nouveaux clients ou aux créneaux rares.'),
            t('Fixez un délai pour payer, sinon un créneau reste bloqué par quelqu’un qui ne viendra peut-être jamais.'),
          ]}
        />

        <P>
          {t('Dans un salon ou un garage, un client qui ne vient pas laisse un fauteuil vide. Chez un laveur mobile, c’est pire : il faut rouler jusque-là, et la demi-heure de route n’est jamais remboursée. C’est pour cela que l’acompte, qu’on associe à des travaux, a toute sa place en lavage à domicile.')}
        </P>

        <H2>{t('Ce que coûte vraiment un rendez-vous manqué')}</H2>
        <P>
          {t('Prenons un exemple, avec des chiffres choisis pour la lisibilité (adaptez-les aux vôtres). Une prestation à 60 € qui dure 1 h 30 rapporte 40 € de l’heure. Si le client est absent après 30 minutes de route, vous avez passé 2 heures sans revenu : 2 × 40 €, soit environ')} <strong>{t('80 € de manque à gagner')}</strong>{t(', si vous n’avez pas pu replacer le créneau. Et vous le replacez rarement à la dernière minute.')}
        </P>
        <P>
          {t('Ce calcul donne l’échelle de l’acompte : il ne s’agit pas de « faire payer d’avance par principe », mais de couvrir ce qu’un lapin vous coûte. Sans cette base, le montant est arbitraire.')}
        </P>
        <P>
          {t('Tous les rendez-vous manqués ne sont pas des lapins : certains clients oublient, tout simplement. Contre l’oubli, le rappel automatique est un autre moyen d’éviter la perte, sans rien demander au client. WashBoard envoie un email 24 h puis 3 h avant le rendez-vous, et vous réglez le nombre de rappels (de 1 à 3) et leur délai, ou vous les éteignez. Il ne retient pas celui qui ne veut pas venir : l’acompte et le rappel se complètent.')}
        </P>

        <H2>{t('Quand demander un acompte, et quand s’en passer')}</H2>
        <UL>
          <li>
            <strong>{t('Prestations longues ou chères.')}</strong>{' '}{t('Un détaillage intérieur de trois heures bloque une demi-journée : l’absence se paie bien plus qu’un lavage extérieur de quarante minutes.')}
          </li>
          <li>
            <strong>{t('Nouveaux clients.')}</strong>{' '}{t('Vous ne savez pas s’ils sont fiables. Un client que vous avez déjà lavé trois fois n’a plus besoin de prouver quoi que ce soit.')}
          </li>
          <li>
            <strong>{t('Plusieurs véhicules.')}</strong>{' '}{t('Une réservation de trois voitures bloque une plage entière. La perdre fait mal.')}
          </li>
          <li>
            <strong>{t('Créneaux rares.')}</strong>{' '}{t('Un samedi complet, la veille d’un long week-end : ce sont ces places-là que vous auriez pu donner à quelqu’un d’autre.')}
          </li>
        </UL>
        <Callout>
          <p>
            <strong>{t('Une limite à connaître.')}</strong>{' '}{t('Dans WashBoard, l’acompte se règle pour toute votre page de réservation : il s’applique à chaque réservation, il n’y a pas aujourd’hui de réglage par client ni par prestation. Si vous voulez le réserver aux grosses prestations, vous ne pouvez pas le faire automatiquement.')}
          </p>
        </Callout>

        <H2>{t('Combien demander')}</H2>
        <P>
          {t('Deux écueils. Trop bas, l’acompte ne retient personne : perdre 5 € pour un lavage à 80 € n’engage à rien. Trop haut, le client qui hésite entre vous et un concurrent qui ne demande rien préfère l’autre. Le bon réglage se situe entre les deux, et dépend de votre calcul d’un rendez-vous manqué : un acompte qui couvre au moins votre déplacement vous protège de la perte la plus sèche. Gardez-le raisonnable et proportionné au préjudice réel : un acompte nettement supérieur à ce qu’un rendez-vous manqué vous coûte est plus difficile à défendre si vous le conservez.')}
        </P>
        <P>
          {t('Une somme fixe a l’avantage d’être simple à payer. Un pourcentage suit le prix de chaque réservation : il convient quand vos prestations varient beaucoup, mais attention — tous les liens de paiement ne le suivent pas (voir plus bas).')}
        </P>

        <H2>{t('Comment le faire payer')}</H2>
        <Table
          head={[t('Moyen'), t('Ce qu’il faut savoir')]}
          rows={[
            [t('PayPal.me'), t('Le montant peut être ajouté à l’adresse du lien : il suit un acompte en pourcentage. Vérifiez les frais de votre compte.')],
            [t('Stripe, SumUp, Lydia'), t('Le montant est fixé quand vous créez le lien. Convient à un acompte d’une somme fixe, pas à un pourcentage.')],
            [t('Virement'), t('En général sans frais de paiement, mais vous devez repérer l’arrivée de l’argent sur votre compte. Prévoyez une référence à indiquer pour reconnaître le virement.')],
            [t('Wero'), t('Paiement entre comptes, par numéro de téléphone ou en scannant un QR code.')],
          ]}
        />
        <P>
          {t('Quel que soit le moyen, un point ne change pas : c’est vous qui recevez l’argent, et c’est vous qui décidez de le rendre. Il n’y a pas de tiers qui encaisse à votre place, donc pas de remboursement automatique — il se fait depuis votre compte de paiement.')}
        </P>

        <H2>{t('Le délai pour payer')}</H2>
        <P>
          {t('Sans délai, un créneau reste bloqué par quelqu’un qui n’a pas payé et ne viendra peut-être jamais. Avec un délai, le client sait qu’il a deux heures, une journée ou deux jours, et vous pouvez relibérer la place. Adaptez-le à la distance du rendez-vous : pour un lavage prévu demain, quelques heures ; pour un rendez-vous dans deux semaines, un ou deux jours suffisent.')}
        </P>
        <H3>{t('Et si vous avez déjà confirmé ?')}</H3>
        <P>
          {t('Une réservation que vous avez confirmée à la main est un choix : vous avez décidé de garder le créneau, acompte ou pas. Ne comptez pas sur un système pour défaire une confirmation à votre place.')}
        </P>

        <H2>{t('Les conditions, à annoncer avant la réservation')}</H2>
        <P>
          {t('Un acompte discuté après coup, c’est un litige en puissance. Le client doit lire, avant de réserver : combien, jusqu’à quand pour payer, s’il est remboursé en cas d’annulation et jusqu’à quand (par exemple jusqu’à 24 ou 48 heures avant), et que le reste se règle sur place. Prévoyez aussi le cas inverse : si c’est vous qui annulez (météo, panne, imprévu), l’acompte est rendu en totalité.')}
        </P>
        <P>
          {t('Ces conditions sont les vôtres : WashBoard les affiche à votre client avant la réservation, mais n’en est pas l’auteur et ne les valide pas.')}
        </P>
        <Callout>
          <p>
            <strong>{t('À vérifier avec vos conditions de vente.')}</strong>{' '}{t('Un acompte et des arrhes ne se comportent pas de la même façon en droit. Un particulier qui réserve en ligne dispose en principe de 14 jours pour se rétracter, y compris pour une prestation à domicile, et le lavage auto ne semble pas faire partie des exceptions (point à confirmer par un professionnel du droit). Si le rendez-vous a lieu avant la fin de ce délai, prévoyez que le client demande expressément que la prestation commence. Ce que nous écrivons ici est une aide à la réflexion, pas un conseil juridique : faites relire vos conditions avant de les appliquer.')}
          </p>
          <p>
            {t('Un professionnel qui vend à des particuliers doit en principe aussi leur indiquer comment joindre un médiateur de la consommation : renseignez-vous auprès de votre organisme d’accompagnement ou d’un professionnel du droit.')}
          </p>
        </Callout>

        <H2>{t('Ce qui ne marche pas')}</H2>
        <UL>
          <li>
            <strong>{t('Un acompte sur tout, pour tout le monde.')}</strong>{' '}{t('Pour un petit lavage à 40 € demandé par un voisin recommandé, c’est un frein à la réservation sans vrai risque à couvrir.')}
          </li>
          <li>
            <strong>{t('Des conditions floues.')}</strong>{' '}{t('« Acompte non remboursable » sans plus de précision, découvert au moment de payer, c’est un client qui abandonne, et une clause que vous ne pourrez pas toujours faire jouer face à un particulier.')}
          </li>
          <li>
            <strong>{t('Courir après le paiement.')}</strong>{' '}{t('Relancer un client par message pour qu’il vous paie son acompte, c’est la corvée que vous vouliez éviter. Un délai et une annulation automatique évitent d’en passer par là.')}
          </li>
          <li>
            <strong>{t('Un pourcentage avec un lien à montant fixe.')}</strong>{' '}{t('Si votre acompte est de 30 % du prix mais que votre lien SumUp ou Stripe demande toujours 20 €, le client paiera 20 € quel que soit le prix de sa réservation.')}
          </li>
          <li>
            <strong>{t('Pas de moyen de paiement évident.')}</strong>{' '}{t('Un seul lien PayPal pour des clients qui n’ont pas PayPal : proposez deux ou trois moyens.')}
          </li>
        </UL>

        <Faq items={faq} />

        <Cta
          title={t('Un acompte sans courir après les paiements')}
          secondary={lienPageMetierTraduit(t, article.theme)}
        >
          {t('Avec WashBoard, vous activez l’acompte, fixez son montant (une somme ou un pourcentage), le délai pour payer et vos conditions de remboursement, que le client lit avant de réserver. Il paie par votre propre lien (PayPal, Stripe, SumUp, Lydia, Wero ou virement) : WashBoard n’encaisse rien, l’argent va directement chez vous. Vous confirmez la réception en un geste sur la fiche du rendez-vous. Avant l’échéance, le client reçoit un rappel par email, et une réservation encore en attente dont l’acompte n’est pas réglé à temps est annulée toute seule, le créneau libéré. L’acompte est inclus dès l’offre gratuite.')}
        </Cta>

        <AlsoRead
          items={[
            { href: '/blog/organiser-ses-tournees-lavage-auto', label: t('Organiser ses tournées pour laver plus de voitures par jour') },
            { href: '/blog/carte-de-fidelite-laveur-auto-mobile', label: t('Carte de fidélité pour laveur auto mobile : faire revenir ses clients') },
            { href: '/blog/tarifs-lavage-auto-domicile', label: t('Quels tarifs pratiquer en lavage auto à domicile') },
            { href: '/blog/devenir-laveur-auto-mobile', label: t('Devenir laveur auto mobile : par où commencer') },
          ]}
        />
      </article>
    </>
  )
}

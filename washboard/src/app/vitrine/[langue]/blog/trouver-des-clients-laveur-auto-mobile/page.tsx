import type { Metadata } from 'next'
import Link from 'next/link'
import { getArticle, SITE_URL } from '@/lib/blog'
import { lienPageMetierTraduit } from '@/lib/metiers'
import { requiredPlanLabel } from '@/lib/plan'
import { H2, P, UL, A, Callout, Summary, Faq, ArticleHeader, Cta, AlsoRead, ArticleJsonLd, type FaqItem } from '@/components/blog/Prose'
import { getTArticle as getT } from '@/lib/i18n/serveur'
import { imagePartage } from '@/lib/imagePartage'
import { alt as altImage } from '@/app/blog/trouver-des-clients-laveur-auto-mobile/opengraph-image'

const article = getArticle('trouver-des-clients-laveur-auto-mobile')!
const url = `${SITE_URL}/blog/${article.slug}`

export const metadata: Metadata = {
  title: `${article.title} | WashBoard`,
  description: article.description,
  alternates: { canonical: url },
  openGraph: {
    images: imagePartage('/blog/trouver-des-clients-laveur-auto-mobile', altImage),
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
    images: imagePartage('/blog/trouver-des-clients-laveur-auto-mobile', altImage),
    card: 'summary_large_image',
    title: article.title,
    description: article.description,
  },
}


export default async function Page() {
  const t = await getT()
  const faq: FaqItem[] = [
    {
      question: t('Comment trouver ses premiers clients en lavage auto à domicile ?'),
      answer:
        t('Créez une fiche d’établissement Google avec une zone de service et vos propres photos avant/après, demandez un avis après chaque prestation dès la première, et proposez un premier véhicule à prix réduit aux garages et concessions de votre secteur. Ces trois actions ne coûtent rien et amènent des clients qui cherchent activement un laveur.'),
    },
    {
      question: t('Faut-il faire de la publicité payante pour un lavage auto mobile ?'),
      answer:
        t('Pas au démarrage. Tant que votre fiche Google n’a pas d’avis ni de photos, la publicité amène des visiteurs qui ne réservent pas. Construisez d’abord la crédibilité (avis, photos, zone claire), puis la publicité locale pourra l’amplifier.'),
    },
    {
      question: t('Quels clients professionnels démarcher quand on est laveur auto mobile ?'),
      answer:
        t('Les garages et carrossiers, les concessions et vendeurs de véhicules d’occasion, les auto-écoles et les entreprises avec une flotte. Ils ont plusieurs véhicules au même endroit, un besoin récurrent et un budget prévisible — l’inverse du particulier qui fait laver sa voiture deux à quatre fois par an.'),
    },
    {
      question: t('Comment obtenir des avis Google quand on est laveur auto ?'),
      answer:
        t('Envoyez un message avec le lien direct vers votre fiche quelques heures après la prestation, le jour même, plutôt que de le demander de vive voix. Le taux de réponse est bien plus élevé, et vous évitez la gêne du face-à-face.'),
    },
  ]

  return (
    <>
      <ArticleJsonLd article={article} siteUrl={SITE_URL} faq={faq} />
      <article>
        <ArticleHeader
          article={article}
          intro={t('Le nerf de la guerre en lavage auto à domicile, ce n\'est pas le matériel ni la technique. C\'est de remplir l\'agenda toutes les semaines, pas seulement les bonnes. Voici les canaux qui marchent vraiment, classés par rapport effort/résultat.')}
        />

        <Summary
          items={[
            t('Le lavage auto à domicile est une activité locale et récurrente : la fiche Google compte plus que les réseaux sociaux, et un client fidélisé vaut plus qu’une prestation.'),
            t('Les avis clients sont le levier le plus sous-exploité : demandez-les le jour même, par message, avec le lien direct.'),
            t('Grouper ses rendez-vous par quartier libère un à deux créneaux par jour — donc de la place pour de nouveaux clients.'),
            t('Les clients professionnels (garages, concessions, flottes) sont moins nombreux mais bien plus rentables.'),
            t('Flyers et publicité payante déçoivent presque toujours au démarrage.'),
          ]}
        />

        <P>
          {t('La plupart des laveurs auto mobiles démarrent avec le bouche-à-oreille : la famille, les collègues, le voisin qui a vu la voiture briller. Ça remplit les premières semaines, puis ça s’essouffle. Le problème n’est pas la qualité du travail — c’est que le bouche-à-oreille seul ne se déclenche pas assez souvent pour tenir un planning.')}
        </P>
        <P>
          {t('Bonne nouvelle : le lavage auto à domicile est une activité')} <strong>{t('locale')}</strong> {t('et')}{' '}
          <strong>{t('récurrente')}</strong>{t('. Ces deux caractéristiques déterminent tout ce qui suit. Local, donc la visibilité sur Google prime sur les réseaux sociaux. Récurrente, donc un client gagné vaut bien plus qu’une prestation.')}
        </P>

        <H2>{t('1. La fiche Google, avant tout le reste')}</H2>
        <P>
          {t('Quand quelqu’un cherche « nettoyage voiture à domicile » suivi du nom de sa ville, Google affiche d’abord une carte avec trois établissements. Y figurer vaut plus que n’importe quel post sur les réseaux : la personne qui fait cette recherche veut réserver maintenant, pas se divertir.')}
        </P>
        <P>
          {t('Créer une fiche d’établissement Google est gratuit, même sans local — nous avons détaillé')}{' '}
          <A href="/blog/fiche-google-laveur-auto-mobile">{t('chaque réglage de la fiche Google dans un guide dédié')}</A>{t('. Trois points font la différence entre une fiche qui dort et une fiche qui amène des appels :')}
        </P>
        <UL>
          <li>
            <strong>{t('Définir une zone de service')}</strong>{' '}{t('plutôt qu’une adresse. Vous vous déplacez : indiquez les communes couvertes, pas votre domicile.')}
          </li>
          <li>
            <strong>{t('Des photos de vos propres prestations')}</strong>{t(', pas des images génériques. Avant/après sur de vraies voitures, prises au téléphone. C’est ce que les gens regardent en premier.')}
          </li>
          <li>
            <strong>{t('Les horaires réellement tenus.')}</strong>{' '}{t('Une fiche qui annonce des créneaux où vous ne répondez jamais fait plus de mal que de bien.')}
          </li>
        </UL>

        <H2>{t('2. Les avis clients : le levier le plus sous-exploité')}</H2>
        <P>
          {t('Entre deux laveurs, celui qui a 27 avis à 4,8 étoiles gagne systématiquement contre celui qui en a 3. Et pourtant la majorité des laveurs ne demandent jamais d’avis, parce que ça met mal à l’aise sur le moment, en face du client.')}
        </P>
        <P>
          {t('La solution est de ne pas le demander de vive voix. Un message envoyé quelques heures après la prestation, quand le client vient de retrouver sa voiture propre, obtient un taux de réponse bien supérieur à une demande faite sur le pas de la porte — et vous évite la gêne. Ce message doit contenir le lien direct vers votre fiche : chaque étape supplémentaire fait perdre la moitié des gens.')}
        </P>
        <Callout>
          <p>
            <strong>{t('Le bon moment, c’est le jour même.')}</strong>{' '}{t('Un avis demandé trois jours plus tard obtient beaucoup moins de réponses : l’effet « waouh » est retombé, la voiture a repris la route. WashBoard envoie cette demande automatiquement, par email ou SMS, avec le délai de votre choix après le rendez-vous (à partir de la formule')}{' '}
            {requiredPlanLabel('avis_email')}).
          </p>
        </Callout>

        <H2>{t('3. Grouper les clients par quartier au lieu de courir partout')}</H2>
        <P>
          {t('Ce point n’a l’air d’être qu’une question d’organisation, mais il agit directement sur votre capacité à prendre des clients. Un laveur qui fait Bordeaux Nord à 9h puis Bordeaux Sud à 10h30 perd 45 minutes de route entre deux prestations. Sur une journée, ce sont deux lavages en moins — donc deux clients refusés faute de créneau. Nous avons détaillé la méthode dans')}{' '}
          <A href="/blog/organiser-ses-tournees-lavage-auto">{t('notre guide pour organiser ses tournées')}</A>.
        </P>
        <P>
          {t('Concentrer les rendez-vous d’une même journée sur une même zone augmente le nombre de prestations sans allonger la journée de travail. C’est le moyen le plus rapide d’augmenter son chiffre d’affaires sans avoir besoin d’un seul client supplémentaire.')}
        </P>
        <P>
          {t('En pratique : proposez à un nouveau client les créneaux où vous êtes déjà dans son secteur, plutôt que de lui laisser choisir n’importe quelle heure de la semaine. Vous pouvez même l’encourager avec une petite remise sur ces créneaux-là.')}
        </P>

        <H2>{t('4. Supprimer les frictions à la réservation')}</H2>
        <P>
          {t('C’est le moment où un')} <strong>{t('outil de gestion pour laveur auto mobile')}</strong>{' '}
          {t('change vraiment quelque chose. Tant que vous avez trois clients par semaine, un carnet suffit. Passé une dizaine de rendez-vous, le temps passé à répondre aux messages, à noter les adresses et à recaler les créneaux dépasse largement celui qu’il faudrait pour laver une voiture de plus.')}
        </P>
        <P>
          {t('Beaucoup de clients potentiels se perdent entre l’intention et le rendez-vous. Le scénario classique : la personne vous envoie un message, vous répondez deux heures plus tard entre deux voitures, elle répond le lendemain, il faut trois allers-retours pour fixer un créneau, et une fois sur trois ça ne se conclut pas.')}
        </P>
        <P>
          {t('Chaque échange perd du monde. Un lien de réservation où le client choisit son créneau, renseigne son adresse et son véhicule tout seul, à 22h s’il le souhaite, transforme nettement mieux qu’un fil WhatsApp — et vous n’avez plus à répondre pendant que vous travaillez.')}
        </P>
        <Callout>
          <p>
            {t('C’est exactement ce que fait WashBoard : un lien personnalisé à mettre dans votre fiche Google, votre bio Instagram et vos messages. Le client réserve seul, sans créer de compte, et vous recevez la demande.')}{' '}
            <Link href="/signup">
              {t('Essai gratuit de 14 jours')}
            </Link>
            {t(', sans carte bancaire.')}
          </p>
        </Callout>

        <H2>{t('5. Les clients professionnels : moins nombreux, bien plus rentables')}</H2>
        <P>
          {t('Un particulier fait laver sa voiture deux à quatre fois par an. Un garage, une concession, une auto-école ou une société avec des véhicules de fonction, c’est du récurrent, parfois hebdomadaire, avec plusieurs véhicules sur place — donc zéro trajet entre deux prestations.')}
        </P>
        <P>{t('Les cibles les plus accessibles quand on démarre :')}</P>
        <UL>
          <li><strong>{t('Garages et carrossiers')}</strong> {t(': ils rendent les véhicules propres à leurs clients et sous-traitent souvent le nettoyage.')}</li>
          <li><strong>{t('Concessions et vendeurs de véhicules d’occasion')}</strong> {t(': une voiture propre se vend mieux et plus vite, l’argument porte tout seul.')}</li>
          <li><strong>{t('Auto-écoles')}</strong> {t(': des véhicules utilisés toute la journée, un budget prévisible.')}</li>
          <li><strong>{t('Sociétés avec flotte')}</strong> {t(': artisans, commerciaux, services à domicile.')}</li>
        </UL>
        <P>
          {t('L’approche qui fonctionne est directe : passer sur place, proposer un premier véhicule à prix réduit, et laisser le résultat parler. C’est un métier où le travail se voit immédiatement — servez-vous-en. Attention toutefois à ne pas brader la suite : le prix d’appel sert à ouvrir la porte, pas à fixer la grille. Voir')}{' '}
          <A href="/blog/tarifs-lavage-auto-domicile">{t('comment calculer un tarif qui tient')}</A>.
        </P>

        <H2>{t('6. Relancer vos anciens clients')}</H2>
        <P>
          {t('C’est le canal le plus rentable, et presque personne ne l’utilise. Une personne qui a déjà fait appel à vous, qui a été satisfaite, et qui connaît vos tarifs n’a aucune raison d’aller ailleurs. Elle a juste oublié — sa voiture s’est resalie progressivement, sans déclic.')}
        </P>
        <P>
          {t('Un message deux ou trois mois après la prestation suffit souvent à déclencher un nouveau rendez-vous. Pas une promotion, pas une relance commerciale insistante : un simple rappel que vous existez, au moment où le besoin est réapparu.')}
        </P>
        <P>
          {t('Faites le calcul sur votre propre fichier : combien de clients servis il y a plus de trois mois et jamais revus ? Chez la plupart des laveurs, c’est le plus gros gisement disponible, et il ne coûte rien à exploiter.')}
        </P>
        <P>
          {t('Pour donner une raison de revenir, et pas seulement un rappel, il existe un second outil : la carte de fidélité. Une prestation offerte ou une remise tous les cinq à dix tampons fait pencher la balance le jour où le client hésite entre vous et la première annonce venue. Combien de tampons, quelle récompense, et ce que cela vous coûte vraiment : voir')}{' '}
          <A href="/blog/carte-de-fidelite-laveur-auto-mobile">{t('notre guide sur la carte de fidélité')}</A>.
        </P>

        <H2>{t('Ce sur quoi il ne faut pas compter au démarrage')}</H2>
        <P>
          {t('Deux choses reviennent souvent et déçoivent presque toujours quand on débute :')}
        </P>
        <UL>
          <li>
            <strong>{t('Les flyers dans les boîtes aux lettres.')}</strong>{' '}{t('Le taux de retour est très faible, et vous touchez des gens qui n’ont aucun besoin au moment où ils lisent — contrairement à quelqu’un qui tape sa recherche sur Google.')}
          </li>
          <li>
            <strong>{t('La publicité payante trop tôt.')}</strong>{' '}{t('Tant que votre fiche Google est vide et que vous n’avez pas d’avis, payer pour amener du monde revient à remplir un seau percé. Construisez d’abord la crédibilité, la publicité viendra l’amplifier.')}
          </li>
        </UL>

        <H2>{t('Par où commencer concrètement')}</H2>
        <P>
          {t('Si vous ne deviez faire que trois choses, dans cet ordre :')}
        </P>
        <UL>
          <li>{t('Créer ou compléter votre fiche d’établissement Google, avec vos vraies photos.')}</li>
          <li>{t('Demander systématiquement un avis après chaque prestation, le jour même.')}</li>
          <li>{t('Relancer tous vos anciens clients de plus de trois mois.')}</li>
        </UL>
        <P>
          {t('Ces trois actions ne coûtent rien d’autre que de la régularité. C’est précisément là que ça coince : les faire une fois ne sert à rien, il faut les faire à chaque client, chaque semaine. C’est la raison pour laquelle la plupart des laveurs finissent par les automatiser.')}
        </P>

        <Faq items={faq} />

        <Cta
          title={t('Lave plus. Roule moins.')}
          secondary={lienPageMetierTraduit(t, article.theme)}
        >
          {t('WashBoard s’occupe des réservations, demande les avis à votre place, relance vos anciens clients, fait tenir la carte de fidélité et, en formule')}{' '}
          {requiredPlanLabel('creneaux_intelligents')}{t(', met en avant les créneaux proches de vos rendez-vous déjà prévus. Vous lavez des voitures, on gère le reste.')}
        </Cta>

        <AlsoRead
          items={[
            { href: '/blog/fiche-google-laveur-auto-mobile', label: t('Fiche Google pour laveur auto mobile : la configurer pour recevoir des appels') },
            { href: '/blog/carte-de-fidelite-laveur-auto-mobile', label: t('Carte de fidélité pour laveur auto mobile : faire revenir ses clients') },
            { href: '/blog/tarifs-lavage-auto-domicile', label: t('Quels tarifs pratiquer en lavage auto à domicile') },
            { href: '/blog/organiser-ses-tournees-lavage-auto', label: t('Organiser ses tournées pour laver plus de voitures par jour') },
            { href: '/blog/devenir-laveur-auto-mobile', label: t('Devenir laveur auto mobile : par où commencer') },
          ]}
        />
      </article>
    </>
  )
}

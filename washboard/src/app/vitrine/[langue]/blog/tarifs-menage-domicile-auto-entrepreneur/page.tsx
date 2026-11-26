import type { Metadata } from 'next'
import { getArticle, SITE_URL } from '@/lib/blog'
import { lienPageMetierTraduit } from '@/lib/metiers'
import { requiredPlanLabel } from '@/lib/plan'
import { H2, H3, P, UL, A, Table, Summary, Faq, ArticleHeader, Cta, AlsoRead, ArticleJsonLd, type FaqItem } from '@/components/blog/Prose'
import { getTArticle as getT } from '@/lib/i18n/serveur'
import { imagePartage } from '@/lib/imagePartage'
import { alt as altImage } from '@/app/blog/tarifs-menage-domicile-auto-entrepreneur/opengraph-image'

const article = getArticle('tarifs-menage-domicile-auto-entrepreneur')!
const url = `${SITE_URL}/blog/${article.slug}`

export const metadata: Metadata = {
  title: `${article.title} | WashBoard`,
  description: article.description,
  alternates: { canonical: url },
  openGraph: {
    images: imagePartage('/blog/tarifs-menage-domicile-auto-entrepreneur', altImage),
    type: 'article',
    url,
    title: article.title,
    description: article.description,
    publishedTime: article.publishedAt,
    modifiedTime: article.updatedAt,
    authors: ['WashBoard'],
    section: 'Ménage à domicile',
  },
  twitter: {
    images: imagePartage('/blog/tarifs-menage-domicile-auto-entrepreneur', altImage),
    card: 'summary_large_image',
    title: article.title,
    description: article.description,
  },
}


export default async function Page() {
  const t = await getT()
  const faq: FaqItem[] = [
    {
      question: t('Quel tarif horaire pour du ménage à domicile en indépendant ?'),
      answer:
        t('Un indépendant en ménage à domicile facture le plus souvent entre 22 et 32 € de l’heure en 2026, davantage en grande ville ou pour des prestations spécifiques (remise en état, fin de location, après travaux : 30 à 45 €). En dessous de 20 €, une fois les cotisations (environ 21 à 22 %) et les trajets déduits, le revenu horaire passe sous le SMIC.'),
    },
    {
      question: t('Combien de clients faut-il pour vivre du ménage à domicile ?'),
      answer:
        t('À 25 € de l’heure et 30 heures facturées par semaine (le reste part en trajets et en organisation), le chiffre d’affaires mensuel atteint environ 3 200 €, soit autour de 2 200 € nets après cotisations et charges. Cela correspond à 12 à 15 clients réguliers de 2 à 3 heures par semaine, idéalement regroupés sur deux ou trois secteurs.'),
    },
  ]

  return (
    <>
      <ArticleJsonLd article={article} siteUrl={SITE_URL} faq={faq} />
      <article>
        <ArticleHeader
          article={article}
          intro={t('Le ménage à domicile est le métier de service le plus demandé en France et l\'un des plus mal payés — parce que la plupart des indépendants fixent leur prix par rapport aux plateformes, pas par rapport à leurs coûts. Voici comment tarifer et comment construire un planning de clients hebdomadaires qui tient.')}
        />

        <Summary
          items={[
            t('Tarif courant pour un indépendant : 22 à 32 € de l’heure, 30 à 45 € pour une remise en état ou une fin de location.'),
            t('Ce qui fait rester un client : la fiabilité (même personne, même créneau) plutôt que le prix le plus bas.'),
            t('Le revenu tient sur des clients réguliers (hebdomadaires ou bi-mensuels) regroupés par secteur, pas sur des interventions ponctuelles.'),
            t('12 à 15 clients réguliers de 2 à 3 heures font un temps plein.'),
          ]}
        />

        <P>
          {t('Dans le ménage, la concurrence est partout : plateformes, particuliers employeurs en CESU, sociétés de services, travail non déclaré. Un indépendant ne gagne pas sur le prix. Il gagne sur la fiabilité (la même personne, au même créneau, chaque semaine) et sur la simplicité pour le client (une réservation, une facture). Tout ce qui suit sert ces deux points. Pour le statut et les démarches, renseignez-vous auprès des organismes officiels : ici, on parle du métier.')}
        </P>

        <H2>{t('1. Les tarifs : partir des coûts, pas des plateformes')}</H2>
        <P>
          {t('Le tarif « de référence » que tout le monde a en tête vient des plateformes, qui affichent 15 à 20 € de l’heure au client en reversant nettement moins à l’intervenant. Ce n’est pas votre référence. La vôtre, c’est le calcul détaillé dans')}{' '}
          <A href="/blog/tarifs-lavage-auto-domicile">{t('notre article sur les tarifs')}</A> {t(': le revenu visé, plus les cotisations, plus les charges, divisé par les heures réellement facturées.')}
        </P>
        <Table
          head={[t('Prestation'), t('Tarif courant'), t('Remarque')]}
          rows={[
            [t('Ménage régulier (hebdo, bi-mensuel)'), '22 – 32 € / h', t('Le cœur de l’activité')],
            [t('Ménage ponctuel'), '28 – 38 € / h', t('Pas de récurrence : plus cher')],
            [t('Repassage'), '22 – 30 € / h', t('Souvent couplé au ménage')],
            [t('Remise en état, fin de location'), t('30 – 45 € / h ou forfait'), t('Sur devis après visite ou photos')],
            [t('Nettoyage après travaux'), '35 – 50 € / h', t('Matériel et produits spécifiques')],
            [t('Location saisonnière (entre deux locataires)'), t('Forfait 60 – 150 €'), t('Clientèle pro : se facture par rotation')],
            [t('Vitres chez le particulier'), '30 – 45 € / h', t('Souvent en complément')],
          ]}
        />
        <P>{t('Trois règles qui protègent la marge :')}</P>
        <UL>
          <li>
            <strong>{t('Un minimum de deux heures par intervention.')}</strong>{' '}{t('Une heure de ménage avec trente minutes de trajet aller-retour ne se rentabilise jamais.')}
          </li>
          <li>
            <strong>{t('Le ponctuel plus cher que le régulier')}</strong>{t(', et dit clairement. Le régulier vous donne de la visibilité ; c’est ça que vous récompensez.')}
          </li>
          <li>
            <strong>{t('Les produits et le matériel : à vous ou au client, mais décidé d’avance.')}</strong>{' '}
            {t('Apporter son matériel professionnel justifie un tarif plus élevé et garantit le résultat ; utiliser celui du client simplifie la logistique. Les deux se pratiquent, l’improvisation non.')}
          </li>
        </UL>

        <H2>{t('2. Construire un planning qui tient')}</H2>
        <P>
          {t('Le ménage est le métier du nettoyage le plus récurrent qui soit : chaque client revient chaque semaine, à la même heure. C’est un immense avantage, à une condition : construire le planning par secteur dès le premier client, pas le réparer au vingtième.')}
        </P>
        <H3>{t('Des créneaux fixes, par secteur')}</H3>
        <P>
          {t('Lundi matin, tel quartier ; lundi après-midi, tel autre. Un nouveau client entre dans le créneau de son secteur, ou attend qu’il s’en libère un. Ça paraît rigide ; c’est exactement ce que les clients veulent entendre : « je suis dans votre quartier le mardi, je peux passer à 9 h ou à 14 h ». La logique est la même que pour')}{' '}
          <A href="/blog/organiser-ses-tournees-lavage-auto">{t('les tournées de lavage auto')}</A>{t(', avec un avantage : ici les créneaux ne bougent plus une fois fixés.')}
        </P>
        <H3>{t('Le trajet, la ligne invisible du planning')}</H3>
        <P>
          {t('Deux clients à 2 heures chacun avec 40 minutes de route entre les deux, c’est 4 heures facturées sur 5 h 20 de travail. Deux clients à 2 heures dans la même rue, c’est 4 heures sur 4 h 10. Sur une semaine, la différence fait un client de plus, sans travailler une minute de plus.')}
        </P>
        <H3>{t('Les absences, les vacances, les clés')}</H3>
        <UL>
          <li>
            <strong>{t('Une règle d’annulation')}</strong>{' '}{t('écrite et acceptée à la première intervention : un créneau annulé moins de 24 ou 48 heures avant est facturé, en tout ou partie. Sans ça, votre agenda se vide à chaque pont.')}
          </li>
          <li>
            <strong>{t('Vos propres congés annoncés deux mois à l’avance')}</strong>{t(', avec éventuellement un remplaçant de confiance.')}
          </li>
          <li>
            <strong>{t('Les clés')}</strong>{' '}{t(': un registre (quel client, quelle clé, remise quand), pas de nom ni d’adresse sur le porte-clés, et une clause dans vos conditions. La perte d’une clé est le sinistre le plus fréquent du métier.')}
          </li>
        </UL>

        <H2>{t('3. Trouver les premiers clients réguliers')}</H2>
        <UL>
          <li>
            <strong>{t('La fiche Google')}</strong>{t(', avec « Service de ménage » en catégorie. Voir')}{' '}
            <A href="/blog/fiche-google-laveur-auto-mobile">{t('comment configurer sa fiche Google')}</A> {t(': tout s’applique, à la catégorie près.')}
          </li>
          <li>
            <strong>{t('Le bouche-à-oreille de quartier')}</strong>{t(', qui marche mieux ici que dans tout autre métier : un client satisfait en parle à ses voisins, et ses voisins sont dans votre secteur. Demandez-le explicitement au bout d’un mois.')}
          </li>
          <li>
            <strong>{t('Les gardiens d’immeuble, les commerces de proximité, les agences immobilières')}</strong>{' '}{t(': ils sont sollicités toutes les semaines par des gens qui cherchent quelqu’un.')}
          </li>
          <li>
            <strong>{t('Les plateformes, pour démarrer seulement.')}</strong>{' '}{t('Elles apportent des premiers clients et des avis ; elles prennent une commission et fixent votre prix. Le but est d’en sortir dès que votre planning est aux deux tiers plein.')}
          </li>
        </UL>

        <H2>{t('4. Ce qui fait rester un client')}</H2>
        <P>
          {t('Dans le ménage, on ne perd presque jamais un client sur le prix. On le perd sur un créneau raté, un oubli, un changement d’intervenant, une facture qui n’arrive pas. La fiabilité se construit avec des outils simples : la confirmation du créneau la veille, la facture envoyée le jour même. Ce sont des tâches de cinq minutes, à faire pour chaque client, chaque semaine — c’est pour ça qu’elles sont oubliées, et c’est pour ça qu’on les automatise.')}
        </P>

        <Faq items={faq} />

        <Cta
          title={t('Vos clients réguliers, dans un agenda qui tient')}
          secondary={lienPageMetierTraduit(t, article.theme)}
        >
          {t('Avec WashBoard, vous voyez votre semaine en un coup d’œil, chaque client a sa fiche et son historique, la facture est créée à la fin de chaque rendez-vous (à partir de la formule')} {requiredPlanLabel('facturation')}{t('), et un nouveau client réserve seul dans les créneaux que vous ouvrez — avec, en formule')} {requiredPlanLabel('creneaux_intelligents')}{t(', une remise possible s’il choisit un créneau proche d’un rendez-vous déjà prévu dans son quartier.')}
        </Cta>

        <AlsoRead
          items={[
            { href: '/blog/devenir-laveur-de-vitres-independant', label: t('Devenir laveur de vitres indépendant : tarifs, matériel, clients') },
            { href: '/blog/nettoyage-canape-domicile-lancer-activite', label: t('Nettoyage de canapés et textiles à domicile : lancer et tarifer l’activité') },
            { href: '/blog/tarifs-lavage-auto-domicile', label: t('Quels tarifs pratiquer en lavage auto à domicile') },
            { href: '/blog/organiser-ses-tournees-lavage-auto', label: t('Organiser ses tournées pour laver plus de voitures par jour') },
          ]}
        />
      </article>
    </>
  )
}

import type { Metadata } from 'next'
import { getArticle, SITE_URL } from '@/lib/blog'
import { lienPageMetierTraduit } from '@/lib/metiers'
import { requiredPlanLabel } from '@/lib/plan'
import { H2, H3, P, UL, A, Callout, Table, Summary, Faq, ArticleHeader, Cta, AlsoRead, ArticleJsonLd, type FaqItem } from '@/components/blog/Prose'
import { getTArticle as getT } from '@/lib/i18n/serveur'

const article = getArticle('devenir-laveur-de-vitres-independant')!
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
    section: 'Vitres',
  },
  twitter: {
    card: 'summary_large_image',
    title: article.title,
    description: article.description,
  },
}


export default async function Page() {
  const t = await getT()
  const faq: FaqItem[] = [
    {
      question: t('Quel tarif pour le lavage de vitres chez un particulier ?'),
      answer:
        t('Chez les particuliers, le lavage de vitres se facture le plus souvent à l’heure, entre 30 et 45 €, ou au forfait par logement : 60 à 120 € pour un appartement, 100 à 250 € pour une maison selon le nombre d’ouvertures, les deux faces et l’accessibilité. Les vitres en hauteur (vérandas, baies à l’étage) et les volets ou stores se facturent en supplément.'),
    },
    {
      question: t('Comment facturer le lavage de vitrines de commerce ?'),
      answer:
        t('Au passage, sur un contrat régulier : 15 à 40 € par passage pour une petite vitrine, davantage pour une grande surface vitrée, avec une fréquence hebdomadaire, bi-mensuelle ou mensuelle. Le prix unitaire est bas mais le volume et la récurrence font le revenu : une tournée de quinze vitrines dans une même rue se fait en une matinée.'),
    },
    {
      question: t('Quel matériel pour se lancer comme laveur de vitres ?'),
      answer:
        t('Un kit de base coûte 150 à 300 € : mouilleur et raclette de qualité (35 et 45 cm), seau, chamois ou microfibres, grattoir, perche télescopique de 3 à 6 mètres et produit. Pour travailler en hauteur sans échelle et sur les grandes surfaces, un système à eau pure (perche à brosse alimentée, filtration par osmose ou résine) représente 800 à 3 000 € ; il s’achète une fois que les contrats réguliers sont là.'),
    },
    {
      question: t('Comment éviter les traces sur les vitres ?'),
      answer:
        t('Trois réflexes : laver à l’ombre ou le côté ensoleillé en premier le matin (l’eau sèche avant la raclette sinon), ne pas oublier les encadrements et les appuis, et passer à l’eau pure pour les grandes surfaces — filtrée par osmose ou résine, elle sèche sans trace.'),
    },
    {
      question: t('Combien gagne un laveur de vitres indépendant ?'),
      answer:
        t('Un laveur de vitres seul, avec une tournée de commerces réguliers et des particuliers en complément, facture généralement 3 000 à 5 000 € par mois, soit autour de 2 000 à 3 500 € nets après cotisations et charges. Le revenu dépend surtout de la densité géographique des clients et de la part de contrats récurrents.'),
    },
  ]

  return (
    <>
      <ArticleJsonLd article={article} siteUrl={SITE_URL} faq={faq} />
      <article>
        <ArticleHeader
          article={article}
          intro={t('Un seau, une raclette, une perche : le lavage de vitres est l\'activité de nettoyage la moins chère à lancer. C\'est aussi l\'une des plus récurrentes — une vitrine se relave toutes les deux semaines. Ce qui fait la différence, ce n\'est pas la technique, c\'est la tournée.')}
        />

        <Summary
          items={[
            t('Moins de 300 € de matériel pour démarrer : mouilleur, raclette, seau, perche.'),
            t('Deux clientèles complémentaires : les commerces (petits montants, passages réguliers, tournées denses) et les particuliers (paniers plus élevés, saisonniers).'),
            t('Tarifs courants : 30 à 45 € de l’heure ou au forfait chez les particuliers, 15 à 40 € par passage pour une vitrine.'),
            t('Le système à eau pure (perche alimentée) change le métier : vitres en hauteur sans échelle, deux fois plus vite. À acheter une fois les contrats en place.'),
            t('Le revenu vient de la densité : quinze vitrines dans la même rue valent mieux que cinq maisons aux quatre coins du département.'),
          ]}
        />

        <P>
          {t('Le lavage de vitres a une particularité que n’ont pas les autres métiers du nettoyage : chaque client revient, à date fixe, sans qu’on ait à le relancer. Une vitrine de boulangerie se salit en dix jours, une véranda en un mois, les fenêtres d’une maison en une saison. Un laveur de vitres ne cherche pas des clients : il construit une tournée. Tout le reste en découle.')}
        </P>

        <P>
          {t('Pour le statut et les démarches, renseignez-vous auprès des organismes officiels : ici, on parle du métier.')}
        </P>

        <H2>{t('1. Le matériel : commencer à 300 €, investir à 3 000 €')}</H2>
        <Table
          head={[t('Poste'), t('Budget indicatif'), t('Remarque')]}
          rows={[
            [t('Mouilleur + raclette (35 et 45 cm)'), '40 – 90 €', t('La qualité de la lame fait la qualité du résultat')],
            [t('Seau rectangulaire, chamois, microfibres'), '30 – 60 €', t('Un chamois par face de vitre')],
            [t('Grattoir + lames'), '15 – 30 €', t('Peinture, adhésifs, fientes')],
            [t('Perche télescopique 3 – 6 m'), '60 – 150 €', t('Indispensable dès le premier étage')],
            [t('Produit (savon ou concentré)'), t('10 – 30 € / mois'), t('Quelques gouttes suffisent')],
            [t('Système à eau pure (perche + filtration)'), '800 – 3 000 €', t('Une fois les contrats réguliers signés')],
          ]}
        />
        <P>
          {t('Le système à eau pure mérite une explication. L’eau du robinet contient des minéraux qui laissent des traces en séchant ; filtrée par osmose ou résine, elle sèche sans trace. Une brosse au bout d’une perche alimentée en eau pure permet de laver une baie du deuxième étage depuis le sol, sans raclette ni essuyage, deux fois plus vite. C’est l’investissement qui fait passer de « je lave des vitres » à « je tiens une tournée de commerces et de copropriétés ».')}
        </P>

        <H2>{t('2. Les deux clientèles, et pourquoi il faut les deux')}</H2>
        <H3>{t('Les commerces : la colonne vertébrale')}</H3>
        <P>
          {t('Boulangeries, pharmacies, agences immobilières, opticiens, banques, restaurants : toute vitrine se lave, et la plupart des commerçants préfèrent payer 25 € toutes les deux semaines que le faire eux-mêmes le lundi matin. Le montant unitaire est bas, mais :')}
        </P>
        <UL>
          <li>{t('Le contrat est')} <strong>{t('récurrent')}</strong> {t(': un commerce signé aujourd’hui est du chiffre d’affaires pendant des années.')}</li>
          <li>{t('Les vitrines sont')} <strong>{t('alignées dans la même rue')}</strong> {t(': quinze passages en une matinée, sans trajet.')}</li>
          <li>{t('Le commerçant ouvre tôt : la tournée se fait de 7 h à 11 h, ce qui libère l’après-midi pour les particuliers.')}</li>
        </UL>
        <P>
          {t('La prospection est la plus simple qui soit : entrer, demander qui lave la vitrine, et proposer un premier passage gratuit. Le résultat se voit depuis le trottoir. Une rue commerçante se signe en deux ou trois semaines de passages.')}
        </P>
        <H3>{t('Les particuliers : le panier moyen')}</H3>
        <P>
          {t('Une maison se facture 100 à 250 €, une véranda seule 60 à 120 €. La demande est saisonnière (printemps, avant les fêtes) et vient de la')}{' '}
          <A href="/blog/fiche-google-laveur-auto-mobile">{t('fiche Google')}</A>{' '}{t('et du bouche-à-oreille de quartier. Les copropriétés sont l’entre-deux idéal : un syndic, un contrat trimestriel, des parties communes vitrées et souvent les fenêtres de plusieurs résidents dans la foulée.')}
        </P>

        <H2>{t('3. Les tarifs pratiqués')}</H2>
        <Table
          head={[t('Prestation'), t('Tarif courant'), t('Temps')]}
          rows={[
            [t('Vitrine de commerce (passage régulier)'), '15 – 40 €', t('10 – 25 min')],
            [t('Appartement (2 faces)'), '60 – 120 €', '1 – 2 h'],
            [t('Maison (2 faces)'), '100 – 250 €', '2 – 4 h'],
            [t('Véranda'), '60 – 120 €', '1 – 2 h'],
            [t('Tarif horaire particulier'), '30 – 45 €', '—'],
            [t('Supplément hauteur, volets, stores'), '+ 20 à 50 %', '—'],
          ]}
        />
        <P>
          {t('Deux règles tiennent la marge. La première :')} <strong>{t('facturer les deux faces')}</strong>{t(', toujours — l’intérieur prend autant de temps que l’extérieur et c’est là que sont les traces de doigts. La seconde :')} <strong>{t('un tarif au passage pour les contrats réguliers')}</strong>{t(', jamais à l’heure, parce que vous irez de plus en plus vite et que c’est votre gain, pas celui du client. La méthode de calcul complète est dans')}{' '}
          <A href="/blog/tarifs-lavage-auto-domicile">{t('notre article sur les tarifs')}</A> {t(': elle vaut pour tous les métiers du nettoyage.')}
        </P>

        <H2>{t('4. Construire la tournée')}</H2>
        <P>
          {t('C’est ici que se joue le revenu. Un laveur de vitres qui accepte tous les clients partout passe la moitié de son temps en voiture. Un laveur qui construit une tournée par secteur et par jour enchaîne les passages à pied.')}
        </P>
        <UL>
          <li>
            <strong>{t('Un secteur par demi-journée.')}</strong>{' '}{t('Lundi matin, la rue commerçante du centre. Mardi matin, la zone d’activité. Quand un nouveau commerce vous appelle, il entre dans le créneau de son secteur, pas dans le premier trou de l’agenda.')}
          </li>
          <li>
            <strong>{t('Une fréquence par client, notée une fois pour toutes.')}</strong>{' '}{t('Hebdomadaire, bi-mensuelle, mensuelle : le passage suivant se planifie tout seul. Le pire ennemi d’une tournée, c’est le client qu’on oublie et qui appelle quelqu’un d’autre.')}
          </li>
          <li>
            <strong>{t('Les particuliers en fin de tournée')}</strong>{t(', dans le même secteur, l’après-midi.')}
          </li>
        </UL>
        <Callout>
          <p>
            <strong>{t('Le calcul qui convainc.')}</strong>{' '}{t('Quinze vitrines à 25 € tous les quinze jours dans une même rue, c’est 750 € par mois pour deux matinées de travail sans un kilomètre entre deux clients. Trois rues comme celle-là font un revenu de base sur lequel on peut construire le reste. Nous détaillons cette logique de tournée dans')}{' '}
            <A href="/blog/organiser-ses-tournees-lavage-auto">{t('l’article sur les tournées')}</A>{t(', écrit pour le lavage auto mais valable à l’identique.')}
          </p>
        </Callout>

        <H2>{t('5. Les erreurs de début')}</H2>
        <UL>
          <li>
            <strong>{t('Facturer les vitrines à l’heure.')}</strong>{' '}{t('Le commerçant veut un prix fixe, et vous perdez votre gain de vitesse.')}
          </li>
          <li>
            <strong>{t('Laver par grand soleil.')}</strong>{' '}{t('L’eau sèche avant la raclette et laisse des traces. Le côté ensoleillé se fait en premier le matin, ou à l’ombre.')}
          </li>
          <li>
            <strong>{t('Oublier les encadrements et les appuis.')}</strong>{' '}{t('Une vitre propre dans un cadre sale ne paraît pas propre. Le client ne dira rien, il ne rappellera pas.')}
          </li>
          <li>
            <strong>{t('Ne pas tenir de liste de passages.')}</strong>{' '}{t('À trente clients réguliers, la mémoire ne suffit plus. Un client oublié deux fois est perdu.')}
          </li>
        </UL>

        <Faq items={faq} />

        <Cta
          title={t('Votre tournée dans un seul agenda')}
          secondary={lienPageMetierTraduit(t, article.theme)}
        >
          {t('Avec WashBoard, vos commerces et vos particuliers sont dans le même agenda, chaque client a sa fiche avec l’historique de ses passages et une alerte quand il n’est pas revenu, et les particuliers réservent seuls sur votre lien — avec, en formule')}{' '}
          {requiredPlanLabel('creneaux_intelligents')}{t(', une remise possible quand ils choisissent un créneau à côté d’un passage déjà prévu. Vous lavez, on tient la liste.')}
        </Cta>

        <AlsoRead
          items={[
            { href: '/blog/tarifs-menage-domicile-auto-entrepreneur', label: t('Ménage à domicile en indépendant : tarifs, planning et clients réguliers') },
            { href: '/blog/nettoyage-haute-pression-terrasses-facades-toitures', label: t('Nettoyage haute pression à domicile : terrasses, façades, toitures') },
            { href: '/blog/organiser-ses-tournees-lavage-auto', label: t('Organiser ses tournées pour laver plus de voitures par jour') },
            { href: '/blog/fiche-google-laveur-auto-mobile', label: t('Fiche Google pour laveur auto mobile : la configurer pour recevoir des appels') },
          ]}
        />
      </article>
    </>
  )
}

import type { Metadata } from 'next'
import { getArticle, SITE_URL } from '@/lib/blog'
import { H2, H3, P, UL, A, Callout, Table, Summary, Faq, ArticleHeader, Cta, AlsoRead, ArticleJsonLd, type FaqItem } from '@/components/blog/Prose'

const article = getArticle('entretien-piscine-domicile-lancer-activite')!
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
    section: 'Piscines',
  },
  twitter: {
    card: 'summary_large_image',
    title: article.title,
    description: article.description,
  },
}

const faq: FaqItem[] = [
  {
    question: 'Combien coûte un contrat d’entretien de piscine ?',
    answer:
      'Un contrat d’entretien régulier se facture le plus souvent 80 à 200 € par mois en saison pour un passage hebdomadaire ou bi-mensuel (analyse et équilibrage de l’eau, nettoyage du bassin, des skimmers et du filtre, vérification du matériel), produits en supplément ou inclus selon la formule. Une mise en route de printemps coûte 150 à 300 €, un hivernage 150 à 350 €, un passage ponctuel 60 à 120 €.',
  },
  {
    question: 'Faut-il un diplôme pour entretenir des piscines ?',
    answer:
      'Non pour l’entretien courant (nettoyage, équilibrage de l’eau, hivernage, mise en route), qui n’est pas une activité réglementée. Des formations existent (CAP, BP métiers de la piscine, formations courtes des fabricants de produits) et sont un vrai atout pour la crédibilité et pour éviter les erreurs de dosage. Les interventions sur l’installation électrique ou hydraulique et la construction relèvent de professionnels qualifiés et assurés pour cela.',
  },
  {
    question: 'Comment lisser une activité d’entretien de piscine sur l’année ?',
    answer:
      'En vendant un abonnement annuel réglé en douze mensualités plutôt que des passages en saison : le client paie la même somme chaque mois, vous avez du revenu en hiver, et l’hivernage et la mise en route sont inclus. En complément, l’hiver sert aux hivernages actifs, aux petites réparations, au remplacement de matériel, et à un second métier comme le nettoyage de terrasses ou le lavage auto.',
  },
  {
    question: 'Quels sont les principaux risques du métier ?',
    answer:
      'Un mauvais dosage qui abîme un liner ou rend l’eau impropre à la baignade, un matériel endommagé (pompe qui tourne à sec, filtre mal remonté), et la manipulation de produits chimiques (chlore, acide) qui exige des précautions de stockage, de transport et de mélange. Une RC pro couvrant les biens confiés et les dommages par produit est indispensable, et le compte-rendu écrit de chaque passage (valeurs mesurées, produits ajoutés) est votre meilleure protection.',
  },
  {
    question: 'Combien de piscines peut-on entretenir par jour ?',
    answer:
      'Un passage d’entretien courant prend 30 à 60 minutes. Avec des clients regroupés par secteur, un pisciniste d’entretien réalise 8 à 12 passages par jour en saison ; dispersés sur tout un département, il en fait 5 ou 6. Une tournée de 40 à 60 contrats hebdomadaires ou bi-mensuels fait un temps plein d’avril à octobre.',
  },
]

export default function Page() {
  return (
    <>
      <ArticleJsonLd article={article} siteUrl={SITE_URL} faq={faq} />
      <article>
        <ArticleHeader
          article={article}
          intro="Plus de trois millions de piscines privées en France, et des propriétaires qui découvrent chaque printemps qu'une eau verte ne se rattrape pas en un week-end. L'entretien de piscine est un métier de contrats réguliers et de tournées — à condition de vendre l'abonnement plutôt que le dépannage."
        />

        <Summary
          items={[
            'Le cœur du métier : un passage hebdomadaire ou bi-mensuel d’avril à octobre — analyse de l’eau, équilibrage, nettoyage, vérification du matériel.',
            'Tarifs courants : 80 à 200 € par mois en contrat, 150 à 300 € la mise en route, 150 à 350 € l’hivernage.',
            'Pas de diplôme obligatoire pour l’entretien, mais une formation courte évite les erreurs de dosage qui coûtent un liner.',
            'L’activité est saisonnière : l’abonnement annuel en douze mensualités et un second métier d’hiver la lissent.',
            'Le revenu vient de la densité : 8 à 12 passages par jour en secteur groupé, 5 ou 6 en dispersé.',
          ]}
        />

        <P>
          Le propriétaire d&apos;une piscine a deux options : y passer deux heures par semaine et
          gérer lui-même la chimie, ou payer quelqu&apos;un pour ne plus y penser. Le marché de
          l&apos;entretien existe parce que la seconde option gagne dès que l&apos;eau a tourné une
          fois. Ce que vous vendez, ce n&apos;est pas du nettoyage : c&apos;est une piscine
          baignable tout l&apos;été sans qu&apos;on s&apos;en occupe.
        </P>

        <H2>1. Ce que couvre l&apos;entretien, et ce qu&apos;il ne couvre pas</H2>
        <P>Un passage d&apos;entretien courant, c&apos;est une liste toujours identique :</P>
        <UL>
          <li><strong>Analyse de l&apos;eau</strong> : pH, désinfectant (chlore, brome ou sel selon le traitement), alcalinité, stabilisant. Les valeurs sont notées à chaque passage.</li>
          <li><strong>Équilibrage</strong> : ajout des produits nécessaires, dans l&apos;ordre et aux doses adaptées au volume du bassin.</li>
          <li><strong>Nettoyage</strong> : ligne d&apos;eau, parois et fond (épuisette, balai ou robot), paniers de skimmers et préfiltre de pompe.</li>
          <li><strong>Filtration</strong> : contravage du filtre à sable, nettoyage de la cartouche, vérification de la pression et du temps de filtration.</li>
          <li><strong>Contrôle du matériel</strong> : pompe, niveau d&apos;eau, fuites visibles, état du liner ou du revêtement.</li>
          <li><strong>Compte-rendu</strong> au client : valeurs, produits ajoutés, points d&apos;attention.</li>
        </UL>
        <P>
          À cela s&apos;ajoutent les deux prestations saisonnières, la <strong>mise en route</strong>{' '}
          au printemps (nettoyage après hivernage, remise en filtration, traitement choc, équilibrage
          complet) et l&apos;<strong>hivernage</strong> à l&apos;automne (passif avec bâche et
          flotteurs, ou actif avec filtration réduite).
        </P>
        <Callout>
          <p>
            <strong>Ce que vous ne faites pas sans qualification et assurance dédiées</strong> :
            intervenir sur l&apos;électricité (coffret, pompe à chaleur, électrolyseur), modifier
            l&apos;hydraulique, réparer une fuite de structure, ou construire. Votre RC pro
            d&apos;entretien ne couvre pas ces travaux. Le bon réflexe est de diagnostiquer,
            d&apos;orienter vers un pisciniste installateur, et de garder le client pour
            l&apos;entretien.
          </p>
        </Callout>

        <H2>2. Les compétences et le cadre</H2>
        <P>
          L&apos;entretien de piscine n&apos;est pas réglementé : la micro-entreprise suffit pour
          démarrer, comme pour{' '}
          <A href="/blog/devenir-laveur-auto-mobile">les autres métiers du nettoyage à domicile</A>.
          Mais c&apos;est le métier de cette famille où l&apos;erreur coûte le plus cher : un pH mal
          corrigé sur un liner, un surdosage de chlore sur un revêtement, un filtre remonté à
          l&apos;envers. Trois choses à mettre en place avant le premier contrat :
        </P>
        <UL>
          <li>
            <strong>Une formation courte</strong>{' '}sur le traitement de l&apos;eau. Les fabricants
            de produits et les distributeurs en proposent, parfois gratuitement. Quelques jours
            qui vous évitent des mois d&apos;apprentissage sur les piscines des clients.
          </li>
          <li>
            <strong>Une RC pro</strong>{' '}couvrant les biens confiés <em>et</em> les dommages par
            produit, avec un plafond cohérent avec le coût d&apos;un liner (plusieurs milliers
            d&apos;euros). Les points à vérifier sont les mêmes que dans{' '}
            <A href="/blog/assurance-laveur-auto-mobile">notre article sur l&apos;assurance</A>.
          </li>
          <li>
            <strong>Les règles de manipulation des produits</strong>{' '}: jamais de mélange (chlore
            et acide, en particulier), stockage ventilé et fermé, transport en petites quantités
            dans des bacs de rétention, équipements de protection. Les fiches de données de
            sécurité de chaque produit disent précisément quoi faire.
          </li>
        </UL>

        <H2>3. Le matériel</H2>
        <Table
          head={['Poste', 'Budget indicatif', 'Remarque']}
          rows={[
            ['Trousse ou photomètre d’analyse', '30 – 300 €', 'Le photomètre est plus fiable et plus rapide'],
            ['Épuisettes, balai aspirateur, manche télescopique', '100 – 250 €', ''],
            ['Brosses (ligne d’eau, parois), éponges', '30 – 80 €', ''],
            ['Robot électrique (optionnel)', '500 – 1 500 €', 'Fait le fond pendant que vous faites le reste'],
            ['Stock de produits de départ', '200 – 500 €', 'Refacturés ou inclus dans le contrat'],
            ['Bacs de rétention, EPI', '50 – 150 €', 'Transport et sécurité'],
            ['Pompe de relevage, matériel d’hivernage', '100 – 300 €', ''],
          ]}
        />
        <P>
          Un budget de départ de 500 à 1 500 € sans robot, jusqu&apos;à 3 000 € avec. Le robot
          n&apos;est pas un luxe : sur une tournée de dix passages par jour, il fait le fond de la
          piscine pendant que vous traitez l&apos;eau et nettoyez les skimmers, et divise le temps
          par passage.
        </P>

        <H2>4. Les tarifs, et pourquoi vendre l&apos;abonnement</H2>
        <Table
          head={['Prestation', 'Tarif courant', 'Remarque']}
          rows={[
            ['Contrat d’entretien, passage hebdomadaire', '120 – 200 € / mois', 'En saison, produits inclus ou en sus'],
            ['Contrat d’entretien, passage bi-mensuel', '80 – 130 € / mois', ''],
            ['Abonnement annuel (12 mensualités)', '70 – 150 € / mois', 'Mise en route et hivernage inclus'],
            ['Mise en route de printemps', '150 – 300 €', 'Hors produits de traitement choc'],
            ['Hivernage', '150 – 350 €', 'Selon passif ou actif, taille du bassin'],
            ['Passage ponctuel, rattrapage d’eau verte', '60 – 120 € + produits', 'Souvent le premier contact'],
          ]}
        />
        <P>
          Le passage ponctuel est la porte d&apos;entrée : un propriétaire découvre une eau verte
          fin juin et cherche « entretien piscine » sur Google. Vous rattrapez l&apos;eau en deux
          passages et vous proposez, sur place, le contrat jusqu&apos;à septembre. Ce
          rattrapage est votre meilleure démonstration commerciale — pas la peine de le brader.
        </P>
        <H3>L&apos;abonnement annuel, la clé du métier</H3>
        <P>
          Facturé en saison seulement, l&apos;entretien de piscine est un revenu d&apos;avril à
          octobre et rien de novembre à mars. Facturé en <strong>douze mensualités</strong>, mise
          en route et hivernage inclus, c&apos;est un revenu régulier toute l&apos;année : le
          client paie 100 € par mois au lieu de 170 € pendant sept mois, il ne voit pas de
          facture d&apos;hivernage, et vous, vous avez de la trésorerie en janvier. La plupart des
          clients préfèrent cette formule dès qu&apos;on la leur propose.
        </P>
        <P>
          Le calcul du prix suit la logique de{' '}
          <A href="/blog/tarifs-lavage-auto-domicile">tous les métiers à domicile</A> — le temps
          réel trajet compris, les produits, les charges — avec un point spécifique : les produits
          pèsent lourd (15 à 40 € par mois et par piscine en saison). Inclus dans le contrat, ils
          simplifient la facture mais vous exposent aux bassins gourmands ; refacturés, ils sont
          transparents mais génèrent des discussions. Choisissez, écrivez-le, tenez-vous-y.
        </P>

        <H2>5. La tournée : le vrai métier</H2>
        <P>
          Une piscine se traite en 30 à 60 minutes. Ce qui fait votre journée, c&apos;est la
          distance entre deux bassins. Les zones pavillonnaires concentrent les piscines : un
          lotissement peut en contenir vingt, un quartier résidentiel une centaine. Une tournée se
          construit par secteur et par jour de la semaine, exactement comme{' '}
          <A href="/blog/organiser-ses-tournees-lavage-auto">les tournées de lavage auto</A> — avec
          un avantage : les passages sont fixes et récurrents, le planning ne bouge presque plus
          une fois construit.
        </P>
        <UL>
          <li><strong>Un jour, un secteur</strong>, et les nouveaux contrats prennent le jour de leur secteur.</li>
          <li><strong>Le compte-rendu après chaque passage</strong>, envoyé au client : valeurs, produits, remarques. C&apos;est ce qui justifie le contrat quand le client ne vous voit jamais (il est au travail), et votre protection en cas de litige.</li>
          <li><strong>Les alertes</strong> : une pression de filtre qui monte, un niveau qui baisse, une pompe bruyante — signalés tout de suite, c&apos;est une réparation à 100 € ; découverts en août, c&apos;est une pompe à 800 €.</li>
        </UL>

        <H2>6. Trouver les clients</H2>
        <UL>
          <li>
            <strong>La fiche Google</strong>, catégorie « Service d&apos;entretien de piscine », avec
            une zone de service couvrant les communes pavillonnaires. Les recherches explosent en
            mai-juin : la fiche doit exister en mars. Voir{' '}
            <A href="/blog/fiche-google-laveur-auto-mobile">notre guide de la fiche Google</A>.
          </li>
          <li>
            <strong>Le voisinage</strong>{' '}: un lotissement, c&apos;est un client qui en amène
            trois. Un petit panneau ou un flyer sur le portail du client, avec son accord, marche
            mieux ici que partout ailleurs.
          </li>
          <li>
            <strong>Les magasins de piscine et les installateurs</strong>{' '}: ils vendent des
            bassins et ne veulent pas les entretenir. Un partenariat d&apos;apport d&apos;affaires
            se négocie en une visite.
          </li>
          <li>
            <strong>Les locations saisonnières et les résidences secondaires</strong>{' '}: leurs
            propriétaires ne sont pas sur place. Ce sont les contrats les plus stables et les
            moins regardants sur le prix.
          </li>
        </UL>

        <H2>7. L&apos;hiver</H2>
        <P>
          Même avec des abonnements annuels, l&apos;hiver est calme. Les piscinistes d&apos;entretien
          qui tiennent le remplissent avec les hivernages actifs (un passage mensuel), les
          petites réparations et remplacements de matériel (pompes, robots, bâches — avec marge sur
          la fourniture), et souvent un second métier de la même famille : le{' '}
          <A href="/blog/nettoyage-haute-pression-terrasses-facades-toitures">nettoyage de terrasses et de façades</A>{' '}
          chez les mêmes clients, ou le lavage auto. Même clientèle, même véhicule, un revenu qui
          ne s&apos;arrête plus en novembre.
        </P>

        <Faq items={faq} />

        <Cta title="Chaque piscine, son historique et sa facture">
          Avec WashBoard, chaque client a sa fiche avec l&apos;historique de tous ses passages et
          leur montant, la facture s&apos;envoie depuis votre téléphone, et votre chiffre
          d&apos;affaires se lit par mois pour suivre la saison. Les nouveaux clients réservent
          leur rattrapage d&apos;eau verte sur votre lien, sans vous appeler.
        </Cta>

        <AlsoRead
          items={[
            { href: '/blog/nettoyage-haute-pression-terrasses-facades-toitures', label: 'Nettoyage haute pression à domicile : terrasses, façades, toitures' },
            { href: '/blog/organiser-ses-tournees-lavage-auto', label: 'Organiser ses tournées pour laver plus de voitures par jour' },
            { href: '/blog/assurance-laveur-auto-mobile', label: 'Quelle assurance pour un laveur auto mobile' },
            { href: '/blog/fiche-google-laveur-auto-mobile', label: 'Fiche Google pour laveur auto mobile : la configurer pour recevoir des appels' },
          ]}
        />
      </article>
    </>
  )
}

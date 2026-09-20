import type { Metadata } from 'next'
import { getArticle, SITE_URL } from '@/lib/blog'
import { H2, H3, P, UL, A, Callout, Table, Summary, Faq, ArticleHeader, Cta, AlsoRead, ArticleJsonLd, type FaqItem } from '@/components/blog/Prose'

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

const faq: FaqItem[] = [
  {
    question: 'Quel tarif pour le lavage de vitres chez un particulier ?',
    answer:
      'Chez les particuliers, le lavage de vitres se facture le plus souvent à l’heure, entre 30 et 45 € TTC, ou au forfait par logement : 60 à 120 € pour un appartement, 100 à 250 € pour une maison selon le nombre d’ouvertures, les deux faces et l’accessibilité. Les vitres en hauteur (vérandas, baies à l’étage) et les volets ou stores se facturent en supplément.',
  },
  {
    question: 'Comment facturer le lavage de vitrines de commerce ?',
    answer:
      'Au passage, sur un contrat régulier : 15 à 40 € par passage pour une petite vitrine, davantage pour une grande surface vitrée, avec une fréquence hebdomadaire, bi-mensuelle ou mensuelle. Le prix unitaire est bas mais le volume et la récurrence font le revenu : une tournée de quinze vitrines dans une même rue se fait en une matinée.',
  },
  {
    question: 'Quel matériel pour se lancer comme laveur de vitres ?',
    answer:
      'Un kit de base coûte 150 à 300 € : mouilleur et raclette de qualité (35 et 45 cm), seau, chamois ou microfibres, grattoir, perche télescopique de 3 à 6 mètres et produit. Pour travailler en hauteur sans échelle et sur les grandes surfaces, un système à eau pure (perche à brosse alimentée, filtration par osmose ou résine) représente 800 à 3 000 € ; il s’achète une fois que les contrats réguliers sont là.',
  },
  {
    question: 'Faut-il un diplôme pour être laveur de vitres ?',
    answer:
      'Non. Le lavage de vitres n’est pas une profession réglementée : la micro-entreprise suffit pour démarrer. Deux points restent obligatoires en pratique : une assurance responsabilité civile professionnelle (vitre cassée, dégât des eaux, chute d’objet) et, pour tout travail en hauteur, le respect des règles de sécurité — un laveur indépendant sur une échelle au-dessus de 3 mètres sans protection engage sa propre responsabilité.',
  },
  {
    question: 'Combien gagne un laveur de vitres indépendant ?',
    answer:
      'Un laveur de vitres seul, avec une tournée de commerces réguliers et des particuliers en complément, facture généralement 3 000 à 5 000 € par mois, soit autour de 2 000 à 3 500 € nets en micro-entreprise après cotisations et charges. Le revenu dépend surtout de la densité géographique des clients et de la part de contrats récurrents.',
  },
]

export default function Page() {
  return (
    <>
      <ArticleJsonLd article={article} siteUrl={SITE_URL} faq={faq} />
      <article>
        <ArticleHeader
          article={article}
          intro="Un seau, une raclette, une perche : le lavage de vitres est l'activité de nettoyage la moins chère à lancer. C'est aussi l'une des plus récurrentes — une vitrine se relave toutes les deux semaines. Ce qui fait la différence, ce n'est pas la technique, c'est la tournée."
        />

        <Summary
          items={[
            'Aucun diplôme, moins de 300 € de matériel pour démarrer, la micro-entreprise suffit.',
            'Deux clientèles complémentaires : les commerces (petits montants, passages réguliers, tournées denses) et les particuliers (paniers plus élevés, saisonniers).',
            'Tarifs courants : 30 à 45 € de l’heure ou au forfait chez les particuliers, 15 à 40 € par passage pour une vitrine.',
            'Le système à eau pure (perche alimentée) change le métier : vitres en hauteur sans échelle, deux fois plus vite. À acheter une fois les contrats en place.',
            'Le revenu vient de la densité : quinze vitrines dans la même rue valent mieux que cinq maisons aux quatre coins du département.',
          ]}
        />

        <P>
          Le lavage de vitres a une particularité que n&apos;ont pas les autres métiers du
          nettoyage : chaque client revient, à date fixe, sans qu&apos;on ait à le relancer. Une
          vitrine de boulangerie se salit en dix jours, une véranda en un mois, les fenêtres
          d&apos;une maison en une saison. Un laveur de vitres ne cherche pas des clients : il
          construit une tournée. Tout le reste en découle.
        </P>

        <H2>1. Le statut et les obligations</H2>
        <P>
          Comme pour{' '}
          <A href="/blog/devenir-laveur-auto-mobile">le lavage auto</A>, la micro-entreprise est le
          régime naturel pour démarrer seul : création en ligne, cotisations calculées sur ce que
          vous encaissez, pas de comptabilité lourde. L&apos;activité relève de la prestation de
          services (nettoyage courant des bâtiments).
        </P>
        <P>Trois points à régler avant le premier client :</P>
        <UL>
          <li>
            <strong>La RC professionnelle.</strong>{' '}Une vitre fêlée par un grattoir, un dégât des
            eaux sur un parquet, une raclette qui tombe du deuxième étage : le risque est réel et
            le coût d&apos;une assurance est faible. Vérifiez que le travail en hauteur est couvert.
          </li>
          <li>
            <strong>La sécurité en hauteur.</strong>{' '}Le Code du travail ne s&apos;applique pas
            au travailleur indépendant pour lui-même, mais votre assureur et votre propre santé,
            si. La perche télescopique et le système à eau pure existent précisément pour ne pas
            monter sur une échelle. Au-delà de 3 mètres, c&apos;est la règle.
          </li>
          <li>
            <strong>La déclaration Services à la personne</strong>, si vous visez surtout les
            particuliers. Le lavage de vitres chez un particulier fait partie des activités
            ouvrant droit au crédit d&apos;impôt de 50 % pour le client — mais la déclaration impose
            une activité exclusive auprès des particuliers, donc pas de commerces. C&apos;est un
            choix structurant, détaillé dans{' '}
            <A href="/blog/tarifs-menage-domicile-auto-entrepreneur">notre article sur le ménage à domicile</A>.
          </li>
        </UL>

        <H2>2. Le matériel : commencer à 300 €, investir à 3 000 €</H2>
        <Table
          head={['Poste', 'Budget indicatif', 'Remarque']}
          rows={[
            ['Mouilleur + raclette (35 et 45 cm)', '40 – 90 €', 'La qualité de la lame fait la qualité du résultat'],
            ['Seau rectangulaire, chamois, microfibres', '30 – 60 €', 'Un chamois par face de vitre'],
            ['Grattoir + lames', '15 – 30 €', 'Peinture, adhésifs, fientes'],
            ['Perche télescopique 3 – 6 m', '60 – 150 €', 'Indispensable dès le premier étage'],
            ['Produit (savon ou concentré)', '10 – 30 € / mois', 'Quelques gouttes suffisent'],
            ['Système à eau pure (perche + filtration)', '800 – 3 000 €', 'Une fois les contrats réguliers signés'],
          ]}
        />
        <P>
          Le système à eau pure mérite une explication. L&apos;eau du robinet contient des minéraux
          qui laissent des traces en séchant ; filtrée par osmose ou résine, elle sèche sans trace.
          Une brosse au bout d&apos;une perche alimentée en eau pure permet de laver une baie du
          deuxième étage depuis le sol, sans raclette ni essuyage, deux fois plus vite. C&apos;est
          l&apos;investissement qui fait passer de « je lave des vitres » à « je tiens une tournée
          de commerces et de copropriétés ».
        </P>

        <H2>3. Les deux clientèles, et pourquoi il faut les deux</H2>
        <H3>Les commerces : la colonne vertébrale</H3>
        <P>
          Boulangeries, pharmacies, agences immobilières, opticiens, banques, restaurants : toute
          vitrine se lave, et la plupart des commerçants préfèrent payer 25 € toutes les deux
          semaines que le faire eux-mêmes le lundi matin. Le montant unitaire est bas, mais :
        </P>
        <UL>
          <li>Le contrat est <strong>récurrent</strong> : un commerce signé aujourd&apos;hui est du chiffre d&apos;affaires pendant des années.</li>
          <li>Les vitrines sont <strong>alignées dans la même rue</strong> : quinze passages en une matinée, sans trajet.</li>
          <li>Le commerçant ouvre tôt : la tournée se fait de 7 h à 11 h, ce qui libère l&apos;après-midi pour les particuliers.</li>
        </UL>
        <P>
          La prospection est la plus simple qui soit : entrer, demander qui lave la vitrine, et
          proposer un premier passage gratuit. Le résultat se voit depuis le trottoir. Une rue
          commerçante se signe en deux ou trois semaines de passages.
        </P>
        <H3>Les particuliers : le panier moyen</H3>
        <P>
          Une maison se facture 100 à 250 €, une véranda seule 60 à 120 €. La demande est
          saisonnière (printemps, avant les fêtes) et vient de la{' '}
          <A href="/blog/fiche-google-laveur-auto-mobile">fiche Google</A>{' '}et du bouche-à-oreille
          de quartier. Les copropriétés sont l&apos;entre-deux idéal : un syndic, un contrat
          trimestriel, des parties communes vitrées et souvent les fenêtres de plusieurs
          résidents dans la foulée.
        </P>

        <H2>4. Les tarifs pratiqués</H2>
        <Table
          head={['Prestation', 'Tarif courant', 'Temps']}
          rows={[
            ['Vitrine de commerce (passage régulier)', '15 – 40 €', '10 – 25 min'],
            ['Appartement (2 faces)', '60 – 120 €', '1 – 2 h'],
            ['Maison (2 faces)', '100 – 250 €', '2 – 4 h'],
            ['Véranda', '60 – 120 €', '1 – 2 h'],
            ['Tarif horaire particulier', '30 – 45 € TTC', '—'],
            ['Supplément hauteur, volets, stores', '+ 20 à 50 %', '—'],
          ]}
        />
        <P>
          Deux règles tiennent la marge. La première : <strong>facturer les deux faces</strong>,
          toujours — l&apos;intérieur prend autant de temps que l&apos;extérieur et c&apos;est là
          que sont les traces de doigts. La seconde : <strong>un tarif au passage pour les
          contrats réguliers</strong>, jamais à l&apos;heure, parce que vous irez de plus en plus
          vite et que c&apos;est votre gain, pas celui du client. La méthode de calcul complète
          est dans{' '}
          <A href="/blog/tarifs-lavage-auto-domicile">notre article sur les tarifs</A> : elle vaut
          pour tous les métiers du nettoyage.
        </P>

        <H2>5. Construire la tournée</H2>
        <P>
          C&apos;est ici que se joue le revenu. Un laveur de vitres qui accepte tous les clients
          partout passe la moitié de son temps en voiture. Un laveur qui construit une tournée
          par secteur et par jour enchaîne les passages à pied.
        </P>
        <UL>
          <li>
            <strong>Un secteur par demi-journée.</strong>{' '}Lundi matin, la rue commerçante du
            centre. Mardi matin, la zone d&apos;activité. Quand un nouveau commerce vous appelle,
            il entre dans le créneau de son secteur, pas dans le premier trou de l&apos;agenda.
          </li>
          <li>
            <strong>Une fréquence par client, notée une fois pour toutes.</strong>{' '}Hebdomadaire,
            bi-mensuelle, mensuelle : le passage suivant se planifie tout seul. Le pire ennemi
            d&apos;une tournée, c&apos;est le client qu&apos;on oublie et qui appelle quelqu&apos;un
            d&apos;autre.
          </li>
          <li>
            <strong>Les particuliers en fin de tournée</strong>, dans le même secteur, l&apos;après-midi.
          </li>
        </UL>
        <Callout>
          <p>
            <strong>Le calcul qui convainc.</strong>{' '}Quinze vitrines à 25 € tous les quinze
            jours dans une même rue, c&apos;est 750 € par mois pour deux matinées de travail sans
            un kilomètre entre deux clients. Trois rues comme celle-là font un revenu de base sur
            lequel on peut construire le reste. Nous détaillons cette logique de tournée dans{' '}
            <A href="/blog/organiser-ses-tournees-lavage-auto">l&apos;article sur les tournées</A>,
            écrit pour le lavage auto mais valable à l&apos;identique.
          </p>
        </Callout>

        <H2>6. Les erreurs de début</H2>
        <UL>
          <li>
            <strong>Facturer les vitrines à l&apos;heure.</strong>{' '}Le commerçant veut un prix fixe,
            et vous perdez votre gain de vitesse.
          </li>
          <li>
            <strong>Laver par grand soleil.</strong>{' '}L&apos;eau sèche avant la raclette et
            laisse des traces. Le côté ensoleillé se fait en premier le matin, ou à l&apos;ombre.
          </li>
          <li>
            <strong>Oublier les encadrements et les appuis.</strong>{' '}Une vitre propre dans un
            cadre sale ne paraît pas propre. Le client ne dira rien, il ne rappellera pas.
          </li>
          <li>
            <strong>Ne pas tenir de liste de passages.</strong>{' '}À trente clients réguliers, la
            mémoire ne suffit plus. Un client oublié deux fois est perdu.
          </li>
        </UL>

        <Faq items={faq} />

        <Cta title="Votre tournée dans un seul agenda">
          Avec WashBoard, vos commerces et vos particuliers sont dans le même agenda, chaque client
          a sa fiche avec l&apos;historique de ses passages et une alerte quand il n&apos;est pas
          revenu, et les particuliers réservent seuls sur votre lien — avec une remise quand ils
          choisissent un créneau à côté d&apos;un passage déjà prévu. Vous lavez, on tient la liste.
        </Cta>

        <AlsoRead
          items={[
            { href: '/blog/tarifs-menage-domicile-auto-entrepreneur', label: 'Ménage à domicile en auto-entrepreneur : tarifs, crédit d’impôt et clients réguliers' },
            { href: '/blog/nettoyage-haute-pression-terrasses-facades-toitures', label: 'Nettoyage haute pression à domicile : terrasses, façades, toitures' },
            { href: '/blog/organiser-ses-tournees-lavage-auto', label: 'Organiser ses tournées pour laver plus de voitures par jour' },
            { href: '/blog/fiche-google-laveur-auto-mobile', label: 'Fiche Google pour laveur auto mobile : la configurer pour recevoir des appels' },
          ]}
        />
      </article>
    </>
  )
}

import type { Metadata } from 'next'
import { getArticle, SITE_URL } from '@/lib/blog'
import { H2, H3, P, UL, A, Callout, Table, Summary, Faq, ArticleHeader, Cta, AlsoRead, ArticleJsonLd, type FaqItem } from '@/components/blog/Prose'

const article = getArticle('nettoyage-haute-pression-terrasses-facades-toitures')!
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
    section: 'Terrasses, façades & toitures',
  },
  twitter: {
    card: 'summary_large_image',
    title: article.title,
    description: article.description,
  },
}

const faq: FaqItem[] = [
  {
    question: 'Quel est le prix du nettoyage d’une terrasse au m² ?',
    answer:
      'Le nettoyage haute pression d’une terrasse se facture généralement 5 à 15 € par m² selon le matériau (béton, dalles, pavés, bois), l’encrassement et l’accès, avec un minimum de déplacement de 80 à 150 €. Une terrasse de 40 m² revient donc à 200 à 500 €. Le traitement anti-mousse ou l’hydrofuge après nettoyage s’ajoutent, 3 à 8 € par m².',
  },
  {
    question: 'Combien coûte le nettoyage d’une façade ?',
    answer:
      'Comptez 10 à 30 € par m² pour un nettoyage de façade à basse ou moyenne pression avec traitement, davantage pour les techniques douces sur supports fragiles (hydrogommage, nébulisation : 30 à 60 € par m²). Une façade de maison de 100 m² se situe entre 1 000 et 3 000 €. Le prix dépend surtout de la hauteur, de l’accès et de la nature du revêtement.',
  },
  {
    question: 'Peut-on nettoyer une toiture au nettoyeur haute pression ?',
    answer:
      'C’est fortement déconseillé sur la plupart des toitures : la haute pression casse les tuiles fragilisées, décape la surface des tuiles béton, fait remonter l’eau sous les tuiles et arrache les mousses avec le grain. Les professionnels sérieux démoussent par brossage ou basse pression, puis appliquent un traitement anti-mousse et, souvent, un hydrofuge. Le travail en toiture exige en outre un équipement de sécurité en hauteur et une assurance qui le couvre.',
  },
  {
    question: 'Quel nettoyeur haute pression pour un professionnel ?',
    answer:
      'Un nettoyeur thermique de 150 à 250 bars et 600 à 1 000 litres par heure, à moteur essence ou diesel, pour être autonome en électricité chez le client : 800 à 3 000 €. On y ajoute un nettoyeur de surface (cloche rotative, 100 à 400 €) pour les terrasses, une rotabuse, une perche télescopique et des lances de différentes longueurs. Les modèles électriques grand public ne tiennent pas un usage quotidien.',
  },
  {
    question: 'Faut-il une autorisation pour utiliser des produits anti-mousse professionnels ?',
    answer:
      'Les traitements anti-mousse et algicides sont des produits biocides. Selon leur catégorie, leur achat et leur utilisation par un professionnel peuvent exiger le certificat Certibiocide, dont les règles ont été renforcées ces dernières années. Vérifiez la catégorie du produit sur sa fiche et les obligations en vigueur avant d’en faire une prestation courante ; à défaut, tenez-vous aux produits accessibles sans certificat.',
  },
]

export default function Page() {
  return (
    <>
      <ArticleJsonLd article={article} siteUrl={SITE_URL} faq={faq} />
      <article>
        <ArticleHeader
          article={article}
          intro="C'est le métier de laveur au sens premier : de l'eau, de la pression, une surface qui change de couleur sous la lance. Des paniers de plusieurs centaines d'euros, une demande qui explose au printemps, et deux pièges — abîmer le support, et accepter des chantiers dispersés qui mangent la journée en route."
        />

        <Summary
          items={[
            'Trois familles de surfaces : terrasses et sols (le volume), façades et murs (le panier moyen), toitures (le risque, à ne pas prendre sans équipement et assurance dédiés).',
            'Tarifs courants : 5 à 15 € le m² de terrasse, 10 à 30 € le m² de façade, minimum de déplacement de 80 à 150 €.',
            'Matériel : nettoyeur thermique 150–250 bars, nettoyeur de surface, rotabuse, perche — 1 500 à 4 000 € pour un kit complet.',
            'La pression abîme autant qu’elle nettoie : le bois, les joints, les tuiles et les enduits se traitent à basse pression ou à la brosse.',
            'Forte saisonnalité (mars à juin, puis septembre-octobre) : grouper les chantiers par quartier et proposer l’hydrofuge en fin de chantier font le revenu.',
          ]}
        />

        <P>
          Le nettoyage extérieur a un avantage sur tous les autres métiers du nettoyage à domicile :
          le résultat est spectaculaire et il se voit depuis la rue. Une moitié de terrasse
          nettoyée à côté de l&apos;autre moitié, c&apos;est une photo qui vend la prestation aux
          voisins. Son inconvénient : c&apos;est aussi le métier où l&apos;on peut faire le plus
          de dégâts en une heure.
        </P>

        <H2>1. Ce que vous vendez</H2>
        <H3>Les terrasses et les sols : le volume</H3>
        <P>
          Béton, dalles, pavés autobloquants, carrelage extérieur, pierre reconstituée, bois. Le
          chantier type fait 20 à 60 m², prend une à trois heures, et se facture 200 à 600 €. Il se
          vend au printemps, quand le propriétaire ressort le salon de jardin et découvre le vert.
          C&apos;est la prestation d&apos;entrée, la plus demandée et la plus simple à bien faire.
        </P>
        <H3>Les façades et les murs : le panier moyen</H3>
        <P>
          Enduit, crépi, pierre, brique, bardage. Un chantier de 60 à 150 m², une journée, 1 000
          à 3 000 €. Ici la haute pression est rarement la bonne réponse : l&apos;enduit se creuse,
          la pierre tendre s&apos;érode, l&apos;eau s&apos;infiltre. La méthode courante est un
          traitement (anti-mousse, algicide) suivi d&apos;un rinçage à basse ou moyenne pression,
          parfois seulement d&apos;un brossage. Les techniques douces (hydrogommage, nébulisation)
          demandent un matériel et une formation spécifiques, et se facturent en conséquence.
        </P>
        <H3>Les toitures : le risque</H3>
        <P>
          C&apos;est la prestation la plus demandée sur Google et la plus dangereuse à deux
          titres : pour vous (chute) et pour le client (tuiles cassées, infiltrations). Le
          démoussage sérieux se fait par brossage et traitement, pas au jet ; il exige un
          équipement de sécurité en hauteur (harnais, ligne de vie ou échafaudage) et une
          assurance qui couvre explicitement le travail en toiture. Beaucoup de laveurs
          indépendants font le choix de ne pas la proposer au démarrage, et de renvoyer vers un
          couvreur. C&apos;est un choix raisonnable.
        </P>

        <H2>2. Le matériel</H2>
        <Table
          head={['Poste', 'Budget indicatif', 'Remarque']}
          rows={[
            ['Nettoyeur haute pression thermique (150–250 bars, 600–1 000 L/h)', '800 – 3 000 €', 'Autonome en électricité, tient l’usage quotidien'],
            ['Nettoyeur de surface (cloche rotative)', '100 – 400 €', 'Terrasses : régulier, sans traces, deux fois plus vite'],
            ['Rotabuse, lances, buses de plusieurs angles', '50 – 200 €', 'La buse fait la différence entre nettoyer et creuser'],
            ['Perche télescopique haute pression', '100 – 400 €', 'Murs et pignons sans échelle'],
            ['Pulvérisateur à pression pour les traitements', '30 – 150 €', 'Anti-mousse, hydrofuge'],
            ['Tuyaux (40 à 60 m), enrouleur', '100 – 300 €', ''],
            ['Cuve d’eau 500–1 000 L (optionnel)', '200 – 600 €', 'Si le client n’a pas de point d’eau au débit suffisant'],
            ['EPI : bottes, lunettes, gants, protection auditive', '80 – 200 €', 'Non négociable avec un thermique'],
          ]}
        />
        <P>
          Comptez 1 500 à 4 000 € pour un kit complet. Le nettoyeur de surface est l&apos;achat le
          plus rentable de la liste : sur une terrasse, il remplace des heures de lance à la main
          et supprime les traces de passage que le client verra en séchant.
        </P>
        <Callout>
          <p>
            <strong>Sur les produits.</strong>{' '}Anti-mousse, algicides, traitements curatifs sont
            des biocides, et leur usage professionnel est encadré : selon la catégorie du produit,
            un certificat (Certibiocide) peut être exigé pour l&apos;acheter et l&apos;appliquer.
            Lisez la fiche de chaque produit, vérifiez les règles en vigueur, et respectez les
            distances aux plantations, aux points d&apos;eau et aux voisins. Un massif brûlé se
            voit huit jours plus tard et coûte plus cher que la prestation.
          </p>
        </Callout>

        <H2>3. Les tarifs</H2>
        <Table
          head={['Prestation', 'Tarif courant', 'Remarque']}
          rows={[
            ['Terrasse béton, dalles, pavés', '5 – 12 € / m²', 'Minimum de déplacement 80 – 150 €'],
            ['Terrasse bois (basse pression, brossage)', '10 – 20 € / m²', 'Plus long, plus délicat'],
            ['Traitement anti-mousse après nettoyage', '+ 2 – 5 € / m²', 'Retarde le retour du vert'],
            ['Hydrofuge ou saturateur bois', '+ 4 – 10 € / m²', 'La meilleure marge du métier'],
            ['Façade, mur de clôture', '10 – 30 € / m²', 'Selon hauteur, accès, support'],
            ['Allée, cour, parking', '4 – 10 € / m²', 'Grandes surfaces : prix dégressif'],
            ['Mobilier de jardin, portail, volets', '50 – 200 € forfait', 'Souvent ajouté sur place'],
          ]}
        />
        <P>
          Le calcul reste celui de{' '}
          <A href="/blog/tarifs-lavage-auto-domicile">tous les métiers à domicile</A> : le temps
          réel, trajet et installation compris (ici, 20 à 30 minutes de mise en place et de
          rangement par chantier), les consommables (carburant du thermique, produits, eau) et
          l&apos;amortissement d&apos;un matériel qui s&apos;use vite. Trois pratiques qui font la
          marge :
        </P>
        <UL>
          <li>
            <strong>Le devis sur photos ou sur place</strong>, jamais au téléphone. Un « béton
            un peu vert » peut être une terrasse noire de lichen qui demande le double de temps.
          </li>
          <li>
            <strong>Le traitement et l&apos;hydrofuge proposés systématiquement</strong>{' '}en
            fin de chantier, quand le client voit le résultat. C&apos;est là que le panier passe
            de 300 à 500 € pour trente minutes de plus.
          </li>
          <li>
            <strong>Le « pendant que je suis là »</strong>{' '}: le mur de clôture, le portail,
            l&apos;allée, le mobilier. Le déplacement est payé, le matériel est sorti — chaque
            ajout est presque entièrement de la marge.
          </li>
        </UL>

        <H2>4. Ce qui abîme, et comment ne pas le faire</H2>
        <UL>
          <li>
            <strong>Le bois</strong>{' '}: la haute pression arrache les fibres et laisse une surface
            pelucheuse qui grise en trois mois. Basse pression, buse large, brossage dans le sens
            du fil, et un saturateur ensuite.
          </li>
          <li>
            <strong>Les joints</strong>{' '}de dalles et de pavés : la lance les vide. Le nettoyeur
            de surface les préserve ; sinon, prévoyez du sable polymère pour les regarnir, et
            facturez-le.
          </li>
          <li>
            <strong>Les enduits et les peintures</strong>{' '}: testez la tenue sur un angle bas
            avant de traiter toute la façade. Un enduit qui part sous la lance est un enduit qui
            était déjà mort, mais c&apos;est vous qui l&apos;aurez fait tomber.
          </li>
          <li>
            <strong>Les tuiles et les ardoises</strong>{' '}: voir plus haut. Pas de haute pression.
          </li>
          <li>
            <strong>Les voisins, les vitres, les voitures</strong>{' '}: les projections portent à
            dix mètres. Bâchez, prévenez, déplacez les véhicules. Une voiture voisine constellée de
            mousse et de produit est la réclamation la plus fréquente du métier.
          </li>
        </UL>
        <P>
          Les photos avant, pendant et après, prises systématiquement, sont votre protection en cas
          de litige et votre publicité entière. Votre RC pro doit couvrir les biens confiés et
          les dommages aux tiers, avec un plafond cohérent avec une façade ou une toiture — les
          points à vérifier sont détaillés dans{' '}
          <A href="/blog/assurance-laveur-auto-mobile">notre article sur l&apos;assurance</A>.
        </P>

        <H2>5. La saison et la tournée</H2>
        <P>
          La demande démarre en mars, explose en avril-mai, retombe en juillet, reprend en
          septembre-octobre et s&apos;arrête avec le gel. Un laveur extérieur qui n&apos;a rien
          prévu fait six mois de chiffre d&apos;affaires et six mois de rien. Deux réponses :
        </P>
        <UL>
          <li>
            <strong>Grouper les chantiers par quartier</strong>, comme{' '}
            <A href="/blog/organiser-ses-tournees-lavage-auto">les tournées de lavage auto</A> :
            un thermique, 60 mètres de tuyau et une cuve se déplacent moins facilement
            qu&apos;un seau. Deux terrasses dans la même rue le même matin, c&apos;est une
            installation pour deux chantiers. Le chantier en cours est aussi votre meilleur
            outil de prospection : les voisins regardent.
          </li>
          <li>
            <strong>Un métier d&apos;hiver</strong>{' '}avec la même clientèle : les{' '}
            <A href="/blog/entretien-piscine-domicile-lancer-activite">hivernages de piscine</A>, les
            gouttières (automne), le lavage auto ou les{' '}
            <A href="/blog/devenir-laveur-de-vitres-independant">vitres</A>. Le client qui vous a fait
            confiance pour sa façade vous confiera sa voiture.
          </li>
        </UL>

        <H2>6. Trouver les chantiers</H2>
        <UL>
          <li>
            <strong>La fiche Google</strong>{' '}avec des avant/après de terrasses et de murs — c&apos;est
            le métier où ces photos sont les plus parlantes. Catégorie « Service de nettoyage
            à haute pression ». Les réglages sont dans{' '}
            <A href="/blog/fiche-google-laveur-auto-mobile">notre guide de la fiche Google</A>.
          </li>
          <li>
            <strong>Le chantier visible</strong>{' '}: un panneau discret sur le portail pendant les
            travaux, avec l&apos;accord du client, et un mot dans les boîtes aux lettres de la rue
            le jour même — c&apos;est le seul cas où le flyer marche, parce que le voisin vient de
            voir le résultat.
          </li>
          <li>
            <strong>Les syndics, les agences immobilières, les gestionnaires de locations
            saisonnières</strong>{' '}: des terrasses et des parties communes à nettoyer chaque
            printemps, sur contrat.
          </li>
          <li>
            <strong>Les paysagistes et les piscinistes</strong>{' '}: ils voient les terrasses sales
            toute la journée et ne veulent pas les nettoyer. Un partenariat d&apos;apport
            d&apos;affaires dans les deux sens.
          </li>
        </UL>

        <Faq items={faq} />

        <Cta title="Des chantiers groupés par quartier">
          Avec WashBoard, chaque demande arrive avec l&apos;adresse et la prestation choisie, les
          frais de déplacement se calculent selon la distance, le client est incité à réserver près
          d&apos;un chantier déjà prévu, et la facture part depuis votre téléphone entre deux
          terrasses.
        </Cta>

        <AlsoRead
          items={[
            { href: '/blog/entretien-piscine-domicile-lancer-activite', label: 'Entretien de piscines à domicile : lancer une activité qui tourne toute l’année' },
            { href: '/blog/devenir-laveur-de-vitres-independant', label: 'Devenir laveur de vitres indépendant : tarifs, matériel, clients' },
            { href: '/blog/tarifs-lavage-auto-domicile', label: 'Quels tarifs pratiquer en lavage auto à domicile' },
            { href: '/blog/assurance-laveur-auto-mobile', label: 'Quelle assurance pour un laveur auto mobile' },
          ]}
        />
      </article>
    </>
  )
}

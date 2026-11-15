import type { Metadata } from 'next'
import { getArticle, SITE_URL } from '@/lib/blog'
import { lienPageMetierTraduit } from '@/lib/metiers'
import { requiredPlanLabel } from '@/lib/plan'
import { H2, H3, P, UL, A, Callout, Table, Summary, Faq, ArticleHeader, Cta, AlsoRead, ArticleJsonLd, type FaqItem } from '@/components/blog/Prose'
import { getTArticle as getT } from '@/lib/i18n/serveur'

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


export default async function Page() {
  const t = await getT()
  const faq: FaqItem[] = [
    {
      question: t('Quel est le prix du nettoyage d’une terrasse au m² ?'),
      answer:
        t('Le nettoyage haute pression d’une terrasse se facture généralement 5 à 15 € par m² selon le matériau (béton, dalles, pavés, bois), l’encrassement et l’accès, avec un minimum de déplacement de 80 à 150 €. Une terrasse de 40 m² revient donc à 200 à 500 €. Le traitement anti-mousse ou l’hydrofuge après nettoyage s’ajoutent, 3 à 8 € par m².'),
    },
    {
      question: t('Combien coûte le nettoyage d’une façade ?'),
      answer:
        t('Comptez 10 à 30 € par m² pour un nettoyage de façade à basse ou moyenne pression avec traitement, davantage pour les techniques douces sur supports fragiles (hydrogommage, nébulisation : 30 à 60 € par m²). Une façade de maison de 100 m² se situe entre 1 000 et 3 000 €. Le prix dépend surtout de la hauteur, de l’accès et de la nature du revêtement.'),
    },
    {
      question: t('Peut-on nettoyer une toiture au nettoyeur haute pression ?'),
      answer:
        t('C’est fortement déconseillé sur la plupart des toitures : la haute pression casse les tuiles fragilisées, décape la surface des tuiles béton, fait remonter l’eau sous les tuiles et arrache les mousses avec le grain. Les professionnels sérieux démoussent par brossage ou basse pression, puis appliquent un traitement anti-mousse et, souvent, un hydrofuge. Le travail en toiture est en outre le plus risqué du métier (chute) : beaucoup de laveurs choisissent de ne pas le proposer.'),
    },
    {
      question: t('Quel nettoyeur haute pression pour un professionnel ?'),
      answer:
        t('Un nettoyeur thermique de 150 à 250 bars et 600 à 1 000 litres par heure, à moteur essence ou diesel, pour être autonome en électricité chez le client : 800 à 3 000 €. On y ajoute un nettoyeur de surface (cloche rotative, 100 à 400 €) pour les terrasses, une rotabuse, une perche télescopique et des lances de différentes longueurs. Les modèles électriques grand public ne tiennent pas un usage quotidien.'),
    },
    {
      question: t('Comment ne pas abîmer le support en nettoyant ?'),
      answer:
        t('Adaptez la pression au matériau : basse pression, buse large et brossage dans le sens du fil pour le bois, nettoyeur de surface pour ne pas vider les joints de dalles, test sur un angle bas avant de traiter un enduit, et pas de haute pression sur les tuiles. Bâchez et prévenez les voisins : les projections portent à dix mètres.'),
    },
  ]

  return (
    <>
      <ArticleJsonLd article={article} siteUrl={SITE_URL} faq={faq} />
      <article>
        <ArticleHeader
          article={article}
          intro={t('C\'est le métier de laveur au sens premier : de l\'eau, de la pression, une surface qui change de couleur sous la lance. Des paniers de plusieurs centaines d\'euros, une demande qui explose au printemps, et deux pièges — abîmer le support, et accepter des chantiers dispersés qui mangent la journée en route.')}
        />

        <Summary
          items={[
            t('Trois familles de surfaces : terrasses et sols (le volume), façades et murs (le panier moyen), toitures (le risque, que beaucoup de laveurs choisissent de ne pas proposer).'),
            t('Tarifs courants : 5 à 15 € le m² de terrasse, 10 à 30 € le m² de façade, minimum de déplacement de 80 à 150 €.'),
            t('Matériel : nettoyeur thermique 150–250 bars, nettoyeur de surface, rotabuse, perche — 1 500 à 4 000 € pour un kit complet.'),
            t('La pression abîme autant qu’elle nettoie : le bois, les joints, les tuiles et les enduits se traitent à basse pression ou à la brosse.'),
            t('Forte saisonnalité (mars à juin, puis septembre-octobre) : grouper les chantiers par quartier et proposer l’hydrofuge en fin de chantier font le revenu.'),
          ]}
        />

        <P>
          {t('Le nettoyage extérieur a un avantage sur tous les autres métiers du nettoyage à domicile : le résultat est spectaculaire et il se voit depuis la rue. Une moitié de terrasse nettoyée à côté de l’autre moitié, c’est une photo qui vend la prestation aux voisins. Son inconvénient : c’est aussi le métier où l’on peut faire le plus de dégâts en une heure.')}
        </P>

        <H2>{t('1. Ce que vous vendez')}</H2>
        <H3>{t('Les terrasses et les sols : le volume')}</H3>
        <P>
          {t('Béton, dalles, pavés autobloquants, carrelage extérieur, pierre reconstituée, bois. Le chantier type fait 20 à 60 m², prend une à trois heures, et se facture 200 à 600 €. Il se vend au printemps, quand le propriétaire ressort le salon de jardin et découvre le vert. C’est la prestation d’entrée, la plus demandée et la plus simple à bien faire.')}
        </P>
        <H3>{t('Les façades et les murs : le panier moyen')}</H3>
        <P>
          {t('Enduit, crépi, pierre, brique, bardage. Un chantier de 60 à 150 m², une journée, 1 000 à 3 000 €. Ici la haute pression est rarement la bonne réponse : l’enduit se creuse, la pierre tendre s’érode, l’eau s’infiltre. La méthode courante est un traitement (anti-mousse, algicide) suivi d’un rinçage à basse ou moyenne pression, parfois seulement d’un brossage. Les techniques douces (hydrogommage, nébulisation) demandent un matériel et une formation spécifiques, et se facturent en conséquence.')}
        </P>
        <H3>{t('Les toitures : le risque')}</H3>
        <P>
          {t('C’est la prestation la plus demandée sur Google et la plus dangereuse à deux titres : pour vous (chute) et pour le client (tuiles cassées, infiltrations). Le démoussage sérieux se fait par brossage et traitement, pas au jet ; il exige un équipement de sécurité en hauteur (harnais, ligne de vie ou échafaudage). Beaucoup de laveurs indépendants font le choix de ne pas la proposer au démarrage, et de renvoyer vers un couvreur. C’est un choix raisonnable.')}
        </P>

        <H2>{t('2. Le matériel')}</H2>
        <Table
          head={[t('Poste'), t('Budget indicatif'), t('Remarque')]}
          rows={[
            [t('Nettoyeur haute pression thermique (150–250 bars, 600–1 000 L/h)'), '800 – 3 000 €', t('Autonome en électricité, tient l’usage quotidien')],
            [t('Nettoyeur de surface (cloche rotative)'), '100 – 400 €', t('Terrasses : régulier, sans traces, deux fois plus vite')],
            [t('Rotabuse, lances, buses de plusieurs angles'), '50 – 200 €', t('La buse fait la différence entre nettoyer et creuser')],
            [t('Perche télescopique haute pression'), '100 – 400 €', t('Murs et pignons sans échelle')],
            [t('Pulvérisateur à pression pour les traitements'), '30 – 150 €', t('Anti-mousse, hydrofuge')],
            [t('Tuyaux (40 à 60 m), enrouleur'), '100 – 300 €', ''],
            [t('Cuve d’eau 500–1 000 L (optionnel)'), '200 – 600 €', t('Si le client n’a pas de point d’eau au débit suffisant')],
            [t('EPI : bottes, lunettes, gants, protection auditive'), '80 – 200 €', t('Non négociable avec un thermique')],
          ]}
        />
        <P>
          {t('Comptez 1 500 à 4 000 € pour un kit complet. Le nettoyeur de surface est l’achat le plus rentable de la liste : sur une terrasse, il remplace des heures de lance à la main et supprime les traces de passage que le client verra en séchant.')}
        </P>
        <Callout>
          <p>
            <strong>{t('Sur les produits.')}</strong>{' '}{t('Anti-mousse, algicides et traitements curatifs sont des produits agressifs pour les plantes. Lisez la fiche de chaque produit, respectez les dosages et les temps de pose, et gardez des distances avec les plantations, les points d’eau et les voisins. Un massif brûlé se voit huit jours plus tard et coûte plus cher que la prestation.')}
          </p>
        </Callout>

        <H2>{t('3. Les tarifs')}</H2>
        <Table
          head={[t('Prestation'), t('Tarif courant'), t('Remarque')]}
          rows={[
            [t('Terrasse béton, dalles, pavés'), '5 – 12 € / m²', t('Minimum de déplacement 80 – 150 €')],
            [t('Terrasse bois (basse pression, brossage)'), '10 – 20 € / m²', t('Plus long, plus délicat')],
            [t('Traitement anti-mousse après nettoyage'), '+ 2 – 5 € / m²', t('Retarde le retour du vert')],
            [t('Hydrofuge ou saturateur bois'), '+ 4 – 10 € / m²', t('La meilleure marge du métier')],
            [t('Façade, mur de clôture'), '10 – 30 € / m²', t('Selon hauteur, accès, support')],
            [t('Allée, cour, parking'), '4 – 10 € / m²', t('Grandes surfaces : prix dégressif')],
            [t('Mobilier de jardin, portail, volets'), t('50 – 200 € forfait'), t('Souvent ajouté sur place')],
          ]}
        />
        <P>
          {t('Le calcul reste celui de')}{' '}
          <A href="/blog/tarifs-lavage-auto-domicile">{t('tous les métiers à domicile')}</A> {t(': le temps réel, trajet et installation compris (ici, 20 à 30 minutes de mise en place et de rangement par chantier), les consommables (carburant du thermique, produits, eau) et l’amortissement d’un matériel qui s’use vite. Trois pratiques qui font la marge :')}
        </P>
        <UL>
          <li>
            <strong>{t('Le devis sur photos ou sur place')}</strong>{t(', jamais au téléphone. Un « béton un peu vert » peut être une terrasse noire de lichen qui demande le double de temps.')}
          </li>
          <li>
            <strong>{t('Le traitement et l’hydrofuge proposés systématiquement')}</strong>{' '}{t('en fin de chantier, quand le client voit le résultat. C’est là que le panier passe de 300 à 500 € pour trente minutes de plus.')}
          </li>
          <li>
            <strong>{t('Le « pendant que je suis là »')}</strong>{' '}{t(': le mur de clôture, le portail, l’allée, le mobilier. Le déplacement est payé, le matériel est sorti — chaque ajout est presque entièrement de la marge.')}
          </li>
        </UL>

        <H2>{t('4. Ce qui abîme, et comment ne pas le faire')}</H2>
        <UL>
          <li>
            <strong>{t('Le bois')}</strong>{' '}{t(': la haute pression arrache les fibres et laisse une surface pelucheuse qui grise en trois mois. Basse pression, buse large, brossage dans le sens du fil, et un saturateur ensuite.')}
          </li>
          <li>
            <strong>{t('Les joints')}</strong>{' '}{t('de dalles et de pavés : la lance les vide. Le nettoyeur de surface les préserve ; sinon, prévoyez du sable polymère pour les regarnir, et facturez-le.')}
          </li>
          <li>
            <strong>{t('Les enduits et les peintures')}</strong>{' '}{t(': testez la tenue sur un angle bas avant de traiter toute la façade. Un enduit qui part sous la lance est un enduit qui était déjà mort, mais c’est vous qui l’aurez fait tomber.')}
          </li>
          <li>
            <strong>{t('Les tuiles et les ardoises')}</strong>{' '}{t(': voir plus haut. Pas de haute pression.')}
          </li>
          <li>
            <strong>{t('Les voisins, les vitres, les voitures')}</strong>{' '}{t(': les projections portent à dix mètres. Bâchez, prévenez, déplacez les véhicules. Une voiture voisine constellée de mousse et de produit est la réclamation la plus fréquente du métier.')}
          </li>
        </UL>
        <P>
          {t('Les photos avant, pendant et après, prises systématiquement, sont votre protection en cas de litige et votre publicité entière.')}
        </P>

        <H2>{t('5. La saison et la tournée')}</H2>
        <P>
          {t('La demande démarre en mars, explose en avril-mai, retombe en juillet, reprend en septembre-octobre et s’arrête avec le gel. Un laveur extérieur qui n’a rien prévu fait six mois de chiffre d’affaires et six mois de rien. Deux réponses :')}
        </P>
        <UL>
          <li>
            <strong>{t('Grouper les chantiers par quartier')}</strong>{t(', comme')}{' '}
            <A href="/blog/organiser-ses-tournees-lavage-auto">{t('les tournées de lavage auto')}</A> {t(': un thermique, 60 mètres de tuyau et une cuve se déplacent moins facilement qu’un seau. Deux terrasses dans la même rue le même matin, c’est une installation pour deux chantiers. Le chantier en cours est aussi votre meilleur outil de prospection : les voisins regardent.')}
          </li>
          <li>
            <strong>{t('Un métier d’hiver')}</strong>{' '}{t('avec la même clientèle : les')}{' '}
            <A href="/blog/entretien-piscine-domicile-lancer-activite">{t('hivernages de piscine')}</A>{t(', les gouttières (automne), le lavage auto ou les')}{' '}
            <A href="/blog/devenir-laveur-de-vitres-independant">{t('vitres')}</A>{t('. Le client qui vous a fait confiance pour sa façade vous confiera sa voiture.')}
          </li>
        </UL>

        <H2>{t('6. Trouver les chantiers')}</H2>
        <UL>
          <li>
            <strong>{t('La fiche Google')}</strong>{' '}{t('avec des avant/après de terrasses et de murs — c’est le métier où ces photos sont les plus parlantes. Catégorie « Service de nettoyage à haute pression ». Les réglages sont dans')}{' '}
            <A href="/blog/fiche-google-laveur-auto-mobile">{t('notre guide de la fiche Google')}</A>.
          </li>
          <li>
            <strong>{t('Le chantier visible')}</strong>{' '}{t(': un panneau discret sur le portail pendant les travaux, avec l’accord du client, et un mot dans les boîtes aux lettres de la rue le jour même — c’est le seul cas où le flyer marche, parce que le voisin vient de voir le résultat.')}
          </li>
          <li>
            <strong>{t('Les syndics, les agences immobilières, les gestionnaires de locations saisonnières')}</strong>{' '}{t(': des terrasses et des parties communes à nettoyer chaque printemps, sur contrat.')}
          </li>
          <li>
            <strong>{t('Les paysagistes et les piscinistes')}</strong>{' '}{t(': ils voient les terrasses sales toute la journée et ne veulent pas les nettoyer. Un partenariat d’apport d’affaires dans les deux sens.')}
          </li>
        </UL>

        <Faq items={faq} />

        <Cta
          title={t('Des chantiers groupés par quartier')}
          secondary={lienPageMetierTraduit(t, article.theme)}
        >
          {t('Avec WashBoard, chaque demande arrive avec l’adresse et la prestation choisie, les frais de déplacement se calculent selon le temps de trajet réel, le client peut être incité à réserver près d’un chantier déjà prévu (formule')} {requiredPlanLabel('creneaux_intelligents')}{t('), et la facture est créée à la fin de chaque chantier (à partir de la formule')} {requiredPlanLabel('facturation')}).
        </Cta>

        <AlsoRead
          items={[
            { href: '/blog/entretien-piscine-domicile-lancer-activite', label: t('Entretien de piscines à domicile : lancer une activité qui tourne toute l’année') },
            { href: '/blog/devenir-laveur-de-vitres-independant', label: t('Devenir laveur de vitres indépendant : tarifs, matériel, clients') },
            { href: '/blog/tarifs-lavage-auto-domicile', label: t('Quels tarifs pratiquer en lavage auto à domicile') },
          ]}
        />
      </article>
    </>
  )
}

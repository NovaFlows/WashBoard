import type { Metadata } from 'next'
import { getArticle, SITE_URL } from '@/lib/blog'
import { H2, H3, P, UL, A, Callout, Table, Summary, Faq, ArticleHeader, Cta, AlsoRead, ArticleJsonLd, type FaqItem } from '@/components/blog/Prose'

const article = getArticle('tarifs-menage-domicile-auto-entrepreneur')!
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
    section: 'Ménage à domicile',
  },
  twitter: {
    card: 'summary_large_image',
    title: article.title,
    description: article.description,
  },
}

const faq: FaqItem[] = [
  {
    question: 'Quel tarif horaire pour du ménage à domicile en auto-entrepreneur ?',
    answer:
      'Un indépendant en ménage à domicile facture le plus souvent entre 22 et 32 € TTC de l’heure en 2026, davantage en grande ville ou pour des prestations spécifiques (remise en état, fin de location, après travaux : 30 à 45 €). En dessous de 20 €, une fois les cotisations (environ 21 à 22 %) et les trajets déduits, le revenu horaire passe sous le SMIC.',
  },
  {
    question: 'Un auto-entrepreneur peut-il faire bénéficier ses clients du crédit d’impôt de 50 % ?',
    answer:
      'Oui, à condition de déclarer son activité de Services à la personne (SAP) auprès de l’administration, via la plateforme NOVA. Le client peut alors déduire 50 % des sommes payées de son impôt sur le revenu, dans la limite des plafonds en vigueur (12 000 € de dépenses par an dans le cas général, majorables). La déclaration impose en contrepartie une activité exclusivement consacrée aux services à la personne auprès des particuliers.',
  },
  {
    question: 'Que signifie la condition d’activité exclusive des Services à la personne ?',
    answer:
      'Une structure déclarée SAP ne peut exercer que des activités de la liste des services à la personne (ménage, repassage, vitres chez le particulier, jardinage, garde d’enfants…), uniquement chez des particuliers. Une micro-entreprise déclarée ne peut donc pas facturer en parallèle des bureaux, des commerces ou du lavage de véhicules. Si vous voulez cumuler, il faut choisir : renoncer à la déclaration, ou séparer les activités dans deux structures.',
  },
  {
    question: 'Faut-il un agrément pour faire du ménage à domicile ?',
    answer:
      'Non. L’agrément n’est obligatoire que pour les activités auprès de publics fragiles (garde d’enfants de moins de trois ans, assistance aux personnes âgées ou handicapées). Le ménage, le repassage et le lavage de vitres chez le particulier relèvent de la simple déclaration, facultative, qui ouvre l’avantage fiscal au client.',
  },
  {
    question: 'Combien de clients faut-il pour vivre du ménage à domicile ?',
    answer:
      'À 25 € de l’heure et 30 heures facturées par semaine (le reste part en trajets et en organisation), le chiffre d’affaires mensuel atteint environ 3 200 €, soit autour de 2 200 € nets après cotisations et charges. Cela correspond à 12 à 15 clients réguliers de 2 à 3 heures par semaine, idéalement regroupés sur deux ou trois secteurs.',
  },
]

export default function Page() {
  return (
    <>
      <ArticleJsonLd article={article} siteUrl={SITE_URL} faq={faq} />
      <article>
        <ArticleHeader
          article={article}
          intro="Le ménage à domicile est le métier de service le plus demandé en France et l'un des plus mal payés — parce que la plupart des indépendants fixent leur prix par rapport aux plateformes, pas par rapport à leurs coûts. Voici comment tarifer, ce que change vraiment le crédit d'impôt, et comment construire un planning de clients hebdomadaires qui tient."
        />

        <Summary
          items={[
            'Tarif courant pour un indépendant : 22 à 32 € TTC de l’heure, 30 à 45 € pour une remise en état ou une fin de location.',
            'La déclaration Services à la personne permet au client de récupérer 50 % en crédit d’impôt — ce qui divise par deux son coût réel et justifie votre tarif.',
            'En contrepartie, la déclaration impose une activité exclusive : particuliers uniquement, pas de bureaux, pas de lavage auto dans la même structure.',
            'Le revenu tient sur des clients réguliers (hebdomadaires ou bi-mensuels) regroupés par secteur, pas sur des interventions ponctuelles.',
            '12 à 15 clients réguliers de 2 à 3 heures font un temps plein.',
          ]}
        />

        <P>
          Dans le ménage, la concurrence est partout : plateformes, particuliers employeurs en
          CESU, sociétés de services, travail non déclaré. Un indépendant ne gagne pas sur le prix.
          Il gagne sur la fiabilité (la même personne, au même créneau, chaque semaine) et sur la
          simplicité pour le client (une réservation, une facture, un crédit d&apos;impôt
          automatique). Tout ce qui suit sert ces deux points.
        </P>

        <H2>1. Le statut et la question qui décide de tout : déclarer ou non</H2>
        <P>
          La micro-entreprise est le régime naturel pour démarrer. Vous facturez vos clients comme
          prestataire (vous n&apos;êtes pas leur salarié, contrairement au CESU) et vous payez vos
          cotisations sur ce que vous encaissez. Jusque-là, rien de spécifique au ménage.
        </P>
        <P>
          La spécificité, c&apos;est la <strong>déclaration Services à la personne</strong> (SAP).
          Elle est facultative, gratuite, se fait en ligne sur la plateforme NOVA, et elle change
          l&apos;économie de votre activité : vos clients peuvent déduire <strong>50 % de ce
          qu&apos;ils vous paient</strong> de leur impôt sur le revenu, dans les plafonds en
          vigueur. Une heure facturée 28 € leur revient à 14 €. Vous facturez au prix juste, ils
          paient le prix d&apos;une plateforme.
        </P>
        <Callout>
          <p>
            <strong>La contrepartie : l&apos;activité exclusive.</strong>{' '}Une structure déclarée
            ne peut exercer que des activités de services à la personne, chez des particuliers.
            Pas de bureaux, pas de commerces, pas de <A href="/blog/devenir-laveur-auto-mobile">lavage auto</A>,
            même occasionnellement. Si vous voulez cumuler, il faut deux structures ou renoncer
            à la déclaration. Cette règle et les plafonds évoluent : vérifiez-les sur
            servicesalapersonne.gouv.fr avant de choisir.
          </p>
        </Callout>
        <P>
          Faut-il déclarer ? Si votre clientèle est faite de particuliers pour du ménage, du
          repassage et des vitres, presque toujours oui : c&apos;est l&apos;argument commercial le
          plus fort du métier, et l&apos;avance immédiate de crédit d&apos;impôt (le client ne paie
          que sa moitié, l&apos;URSSAF vous verse le reste) supprime même l&apos;avance de
          trésorerie de son côté. Si vous visez aussi des bureaux ou des locations saisonnières
          (des professionnels, donc), la déclaration vous ferme ces portes.
        </P>
        <P>
          Pas besoin d&apos;<strong>agrément</strong>, en revanche : il n&apos;est exigé que pour
          les publics fragiles (enfants de moins de trois ans, personnes âgées ou handicapées).
        </P>

        <H2>2. Les tarifs : partir des coûts, pas des plateformes</H2>
        <P>
          Le tarif « de référence » que tout le monde a en tête vient des plateformes, qui
          affichent 15 à 20 € de l&apos;heure au client en reversant nettement moins à
          l&apos;intervenant. Ce n&apos;est pas votre référence. La vôtre, c&apos;est le calcul
          détaillé dans{' '}
          <A href="/blog/tarifs-lavage-auto-domicile">notre article sur les tarifs</A> : le revenu
          visé, plus les cotisations, plus les charges, divisé par les heures réellement
          facturées.
        </P>
        <Table
          head={['Prestation', 'Tarif courant (TTC)', 'Remarque']}
          rows={[
            ['Ménage régulier (hebdo, bi-mensuel)', '22 – 32 € / h', 'Le cœur de l’activité'],
            ['Ménage ponctuel', '28 – 38 € / h', 'Pas de récurrence : plus cher'],
            ['Repassage', '22 – 30 € / h', 'Souvent couplé au ménage'],
            ['Remise en état, fin de location', '30 – 45 € / h ou forfait', 'Sur devis après visite ou photos'],
            ['Nettoyage après travaux', '35 – 50 € / h', 'Matériel et produits spécifiques'],
            ['Location saisonnière (entre deux locataires)', 'Forfait 60 – 150 €', 'Pro : incompatible avec la déclaration SAP'],
            ['Vitres chez le particulier', '30 – 45 € / h', 'Activité SAP, souvent en complément'],
          ]}
        />
        <P>Trois règles qui protègent la marge :</P>
        <UL>
          <li>
            <strong>Un minimum de deux heures par intervention.</strong>{' '}Une heure de ménage
            avec trente minutes de trajet aller-retour ne se rentabilise jamais.
          </li>
          <li>
            <strong>Le ponctuel plus cher que le régulier</strong>, et dit clairement. Le régulier
            vous donne de la visibilité ; c&apos;est ça que vous récompensez.
          </li>
          <li>
            <strong>Les produits et le matériel : à vous ou au client, mais décidé d&apos;avance.</strong>{' '}
            Apporter son matériel professionnel justifie un tarif plus élevé et garantit le
            résultat ; utiliser celui du client simplifie la logistique. Les deux se pratiquent,
            l&apos;improvisation non.
          </li>
        </UL>

        <H2>3. Construire un planning qui tient</H2>
        <P>
          Le ménage est le métier du nettoyage le plus récurrent qui soit : chaque client revient
          chaque semaine, à la même heure. C&apos;est un immense avantage, à une condition :
          construire le planning par secteur dès le premier client, pas le réparer au vingtième.
        </P>
        <H3>Des créneaux fixes, par secteur</H3>
        <P>
          Lundi matin, tel quartier ; lundi après-midi, tel autre. Un nouveau client entre dans le
          créneau de son secteur, ou attend qu&apos;il s&apos;en libère un. Ça paraît rigide ;
          c&apos;est exactement ce que les clients veulent entendre : « je suis dans votre
          quartier le mardi, je peux passer à 9 h ou à 14 h ». La logique est la même que pour{' '}
          <A href="/blog/organiser-ses-tournees-lavage-auto">les tournées de lavage auto</A>, avec
          un avantage : ici les créneaux ne bougent plus une fois fixés.
        </P>
        <H3>Le trajet, la ligne invisible du planning</H3>
        <P>
          Deux clients à 2 heures chacun avec 40 minutes de route entre les deux, c&apos;est 4
          heures facturées sur 5 h 20 de travail. Deux clients à 2 heures dans la même rue,
          c&apos;est 4 heures sur 4 h 10. Sur une semaine, la différence fait un client de plus,
          sans travailler une minute de plus.
        </P>
        <H3>Les absences, les vacances, les clés</H3>
        <UL>
          <li>
            <strong>Une règle d&apos;annulation</strong>{' '}écrite et acceptée à la première
            intervention : un créneau annulé moins de 24 ou 48 heures avant est facturé, en tout
            ou partie. Sans ça, votre agenda se vide à chaque pont.
          </li>
          <li>
            <strong>Vos propres congés annoncés deux mois à l&apos;avance</strong>, avec
            éventuellement un remplaçant de confiance.
          </li>
          <li>
            <strong>Les clés</strong>{' '}: un registre (quel client, quelle clé, remise quand), pas
            de nom ni d&apos;adresse sur le porte-clés, et une clause dans vos conditions. La
            perte d&apos;une clé est le sinistre le plus fréquent du métier — votre RC pro doit
            couvrir le remplacement d&apos;une serrure.
          </li>
        </UL>

        <H2>4. Trouver les premiers clients réguliers</H2>
        <UL>
          <li>
            <strong>La fiche Google</strong>, avec « Service de ménage » en catégorie et la mention
            du crédit d&apos;impôt dans la description. Voir{' '}
            <A href="/blog/fiche-google-laveur-auto-mobile">comment configurer sa fiche Google</A> :
            tout s&apos;applique, à la catégorie près.
          </li>
          <li>
            <strong>Le bouche-à-oreille de quartier</strong>, qui marche mieux ici que dans tout
            autre métier : un client satisfait en parle à ses voisins, et ses voisins sont dans
            votre secteur. Demandez-le explicitement au bout d&apos;un mois.
          </li>
          <li>
            <strong>Les gardiens d&apos;immeuble, les commerces de proximité, les agences
            immobilières</strong>{' '}: ils sont sollicités toutes les semaines par des gens qui
            cherchent quelqu&apos;un.
          </li>
          <li>
            <strong>Les plateformes, pour démarrer seulement.</strong>{' '}Elles apportent des
            premiers clients et des avis ; elles prennent une commission et fixent votre prix. Le
            but est d&apos;en sortir dès que votre planning est aux deux tiers plein.
          </li>
        </UL>

        <H2>5. Ce qui fait rester un client</H2>
        <P>
          Dans le ménage, on ne perd presque jamais un client sur le prix. On le perd sur un
          créneau raté, un oubli, un changement d&apos;intervenant, une facture qui n&apos;arrive
          pas. La fiabilité se construit avec des outils simples : la confirmation du créneau la
          veille, la facture envoyée le jour même, l&apos;attestation fiscale annuelle transmise
          en janvier sans qu&apos;on vous la demande. Ce sont des tâches de cinq minutes, à faire
          pour chaque client, chaque semaine — c&apos;est pour ça qu&apos;elles sont oubliées, et
          c&apos;est pour ça qu&apos;on les automatise.
        </P>

        <Faq items={faq} />

        <Cta title="Vos clients réguliers, dans un agenda qui tient">
          Avec WashBoard, vous voyez votre semaine en un coup d&apos;œil, chaque client a sa fiche
          et son historique, la facture s&apos;envoie en un clic, et un nouveau client réserve seul
          dans les créneaux que vous ouvrez — avec une remise s&apos;il choisit un créneau proche
          d&apos;un rendez-vous déjà prévu dans son quartier.
        </Cta>

        <AlsoRead
          items={[
            { href: '/blog/devenir-laveur-de-vitres-independant', label: 'Devenir laveur de vitres indépendant : tarifs, matériel, clients' },
            { href: '/blog/nettoyage-canape-domicile-lancer-activite', label: 'Nettoyage de canapés et textiles à domicile : lancer et tarifer l’activité' },
            { href: '/blog/tarifs-lavage-auto-domicile', label: 'Quels tarifs pratiquer en lavage auto à domicile' },
            { href: '/blog/organiser-ses-tournees-lavage-auto', label: 'Organiser ses tournées pour laver plus de voitures par jour' },
          ]}
        />
      </article>
    </>
  )
}

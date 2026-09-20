import type { Metadata } from 'next'
import { getArticle, SITE_URL } from '@/lib/blog'
import { H2, H3, P, UL, A, Callout, Table, Summary, Faq, ArticleHeader, Cta, AlsoRead, ArticleJsonLd, type FaqItem } from '@/components/blog/Prose'

const article = getArticle('combien-gagne-un-laveur-auto-mobile')!
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
    section: 'Revenus',
  },
  twitter: {
    card: 'summary_large_image',
    title: article.title,
    description: article.description,
  },
}

const faq: FaqItem[] = [
  {
    question: 'Combien gagne un laveur auto mobile par mois ?',
    answer:
      'En micro-entreprise, un laveur auto mobile à temps plein dégage généralement entre 1 500 et 3 500 € nets par mois selon son organisation : autour de 1 500 à 1 700 € la première année avec 3 véhicules par jour dispersés, 3 000 à 3 500 € une fois installé avec 4 à 5 véhicules par jour groupés par secteur, et jusqu’à 5 000 à 6 000 € avec des clients professionnels et du detailing. Ces chiffres sont après cotisations sociales et charges, avant impôt sur le revenu.',
  },
  {
    question: 'Quel chiffre d’affaires peut faire un laveur auto à domicile ?',
    answer:
      'Entre 2 500 et 6 000 € par mois pour une personne seule en lavage classique. Le plafond vient du temps : à 4 ou 5 véhicules par jour et un panier moyen de 55 à 65 €, on atteint 5 000 à 6 000 € sur 20 jours travaillés. Au-delà, il faut soit monter les prix (detailing, traitements), soit embaucher.',
  },
  {
    question: 'Le lavage auto mobile est-il rentable ?',
    answer:
      'Oui, à condition de tenir trois choses : un tarif calculé sur le temps réel (trajet compris), des rendez-vous groupés par secteur pour limiter la route, et une part de clients récurrents ou professionnels pour lisser l’activité. Un laveur qui accepte tous les clients partout, à bas prix, travaille beaucoup pour un revenu proche du SMIC.',
  },
  {
    question: 'Combien de voitures faut-il laver par jour pour bien vivre ?',
    answer:
      'Quatre par jour, cinq jours par semaine, à un panier moyen de 60 €, donnent environ 4 800 € de chiffre d’affaires mensuel, soit autour de 3 000 € nets en micro-entreprise après cotisations (≈ 22 %) et charges (≈ 650 €), avant impôt. Ce rythme est tenable seulement si les rendez-vous sont groupés géographiquement.',
  },
]

export default function Page() {
  return (
    <>
      <ArticleJsonLd article={article} siteUrl={SITE_URL} faq={faq} />
      <article>
        <ArticleHeader
          article={article}
          intro="Les vidéos qui promettent 5 000 € par mois en lavant des voitures oublient toujours la même ligne : les charges. Voici une simulation honnête, chiffres à l'appui, et ce qui sépare vraiment un laveur qui vivote d'un laveur qui vit bien."
        />

        <Summary
          items={[
            'Un laveur auto mobile seul, à temps plein, dégage le plus souvent entre 1 500 et 3 500 € nets par mois — jusqu’à 6 000 € avec des clients pros et du detailing.',
            'En lavage classique, le chiffre d’affaires plafonne autour de 5 000 à 6 000 € pour une personne : la limite, c’est le nombre d’heures, pas la demande.',
            'Retirez environ 21 à 22 % de cotisations, puis 400 à 700 € de charges mensuelles (véhicule, produits, assurance, téléphone, outils).',
            'Trois leviers font monter le revenu : le prix par heure facturée, la densité des tournées, la part de clients récurrents et pros.',
            'Les revenus les plus élevés viennent du detailing et des flottes, pas du volume de lavages simples.',
          ]}
        />

        <P>
          Il n&apos;existe pas de statistique officielle sur le revenu des laveurs mobiles :
          l&apos;activité est presque toujours exercée en micro-entreprise, et les situations vont du
          complément de revenu le week-end au temps plein avec des clients d&apos;entreprise. Ce qui
          suit est construit à partir de ce que nous observons chez les laveurs avec lesquels nous
          travaillons, et de la grille de{' '}
          <A href="/blog/tarifs-lavage-auto-domicile">tarifs pratiqués en France</A>.
        </P>

        <H2>D&apos;abord, le plafond : combien d&apos;heures facturables</H2>
        <P>
          Le lavage auto se vend au temps. Une personne seule ne peut pas facturer plus
          d&apos;heures qu&apos;elle n&apos;en a, et elle ne facture jamais toutes celles
          qu&apos;elle travaille. Sur une journée de 9 heures, entre la route, l&apos;installation,
          les messages et les trous dans le planning, un laveur bien organisé facture 6 heures.
          Un laveur mal organisé, 4.
        </P>
        <P>
          C&apos;est pour ça que le chiffre d&apos;affaires d&apos;un laveur seul, en lavage
          classique, dépasse rarement 6 000 € par mois, quelle que soit la demande. Les seuls moyens de passer au-dessus sont
          de vendre plus cher l&apos;heure (detailing, traitements, rénovation) ou d&apos;embaucher.
        </P>

        <H2>Trois profils, trois revenus</H2>
        <P>
          Les trois profils ci-dessous travaillent le même nombre de jours (20 par mois). Ce qui
          change, c&apos;est l&apos;organisation et la clientèle — pas l&apos;effort.
        </P>

        <H3>Profil 1 — Première année, clients dispersés</H3>
        <P>
          Trois véhicules par jour, souvent éloignés les uns des autres, un panier moyen de 45 €
          tiré vers le bas par les prix « pour démarrer ». Beaucoup de route, un agenda irrégulier.
        </P>

        <H3>Profil 2 — Installé, tournées par secteur</H3>
        <P>
          Quatre à cinq véhicules par jour groupés par quartier, un panier moyen de 60 € avec des
          suppléments (SUV, intérieur encrassé) réellement facturés, et une base de clients
          récurrents qui remplit un tiers de l&apos;agenda sans prospection.
        </P>

        <H3>Profil 3 — Avec clients professionnels et detailing</H3>
        <P>
          Deux ou trois journées par semaine chez des garages, concessions ou flottes (plusieurs
          véhicules au même endroit, zéro trajet), le reste en particuliers avec une offre de
          detailing ou de traitement céramique qui monte le panier moyen à 80 €.
        </P>

        <Table
          head={['', 'Profil 1', 'Profil 2', 'Profil 3']}
          rows={[
            ['Véhicules par jour', '3', '4,5', '5,5'],
            ['Panier moyen', '45 €', '60 €', '80 €'],
            ['Chiffre d’affaires mensuel', '2 700 €', '5 400 €', '8 800 €'],
            ['Cotisations sociales (≈ 22 %)', '– 590 €', '– 1 190 €', '– 1 940 €'],
            ['Charges (véhicule, produits, assurance…)', '– 450 €', '– 650 €', '– 900 €'],
            ['Revenu net avant impôt', '≈ 1 650 €', '≈ 3 550 €', '≈ 5 950 €'],
            ['Heures travaillées / semaine', '45 h', '45 h', '48 h'],
          ]}
        />
        <Callout>
          <p>
            <strong>Ces chiffres sont des ordres de grandeur</strong>, pas des promesses. Le taux
            de cotisations dépend de votre situation (ACRE la première année, versement
            libératoire, etc.), la CFE s&apos;ajoute à partir de la deuxième année, et l&apos;impôt
            sur le revenu n&apos;est pas déduit. Vérifiez les taux en vigueur sur le site de
            l&apos;URSSAF.
          </p>
        </Callout>
        <P>
          Le point à retenir n&apos;est pas la valeur exacte de chaque case, c&apos;est
          l&apos;écart entre les colonnes : <strong>du simple au triple pour le même nombre
          d&apos;heures</strong>. Personne dans ce tableau ne travaille plus que les autres.
        </P>

        <H2>Ce que le chiffre d&apos;affaires ne dit pas : les charges</H2>
        <P>
          C&apos;est la ligne que les vidéos oublient. Voici ce qu&apos;un laveur mobile paie
          chaque mois, même les mois creux :
        </P>
        <Table
          head={['Poste', 'Mensuel indicatif']}
          rows={[
            ['Véhicule (carburant, entretien, assurance pro)', '200 – 400 €'],
            ['Produits et microfibres', '80 – 200 €'],
            ['Assurance RC pro avec biens confiés', '20 – 50 €'],
            ['Téléphone, logiciel de gestion, site', '30 – 80 €'],
            ['Amortissement du matériel', '30 – 80 €'],
            ['CFE (à partir de la 2ᵉ année, lissée)', '20 – 60 €'],
          ]}
        />
        <P>
          Entre 400 et 700 € par mois selon le kilométrage — et le kilométrage dépend directement
          de la façon dont vous{' '}
          <A href="/blog/organiser-ses-tournees-lavage-auto">organisez vos tournées</A>. Un laveur
          qui traverse la ville entre chaque client paie plus de carburant <em>et</em> facture
          moins d&apos;heures : la charge monte pendant que le revenu descend.
        </P>

        <H2>Les trois leviers qui font vraiment la différence</H2>
        <H3>1. Le prix par heure facturée</H3>
        <P>
          Pas le prix affiché, le prix par heure réellement passée, trajet compris. Un lavage
          complet à 70 € qui prend 1 h 30 sur place et 20 minutes de route rapporte 38 € de
          l&apos;heure. Le même à 55 € avec 45 minutes de route tombe à 24 €. Facturer les
          suppléments (gabarit, encrassement) et refuser les clients trop loin agit plus vite sur
          le revenu que n&apos;importe quelle hausse de tarif.
        </P>
        <H3>2. La densité des tournées</H3>
        <P>
          Passer de 3 à 4,5 véhicules par jour ne demande pas de travailler plus vite : ça demande
          de mettre les rendez-vous les uns à côté des autres. C&apos;est le levier qui sépare le
          profil 1 du profil 2, et il ne coûte rien.
        </P>
        <H3>3. Les clients récurrents et professionnels</H3>
        <P>
          Un particulier fait laver sa voiture trois fois par an. Une flotte de dix véhicules
          d&apos;entreprise, c&apos;est une journée entière tous les mois, au même endroit, sans
          prospection. Trois clients de ce type suffisent à lisser un agenda. Comment les trouver
          est détaillé dans{' '}
          <A href="/blog/trouver-des-clients-laveur-auto-mobile">notre guide sur les canaux qui marchent</A>.
        </P>

        <H2>Et pour dépasser ces chiffres ?</H2>
        <P>
          Au-delà de 6 000 € de chiffre d&apos;affaires, une personne seule bute sur le temps. Les
          laveurs qui vont plus loin font l&apos;un de ces deux choix :
        </P>
        <UL>
          <li>
            <strong>Monter en gamme</strong>{' '}: detailing, correction de peinture, traitement
            céramique. Une journée facturée 400 à 700 € au lieu de 300 €, avec moins de véhicules
            et une clientèle qui ne discute pas le prix.
          </li>
          <li>
            <strong>Embaucher ou sous-traiter</strong>{' '}: un second laveur sur un second secteur.
            C&apos;est là que la micro-entreprise atteint sa limite et qu&apos;il faut penser à une
            société — et à une gestion des plannings qui ne tient plus dans un carnet.
          </li>
        </UL>
        <P>
          Dans les deux cas, le préalable est le même : un profil 2 solide, avec des tournées
          denses, des tarifs tenus et une base de clients qui revient. Sans ça, ni le detailing ni
          l&apos;embauche ne tiennent.
        </P>

        <Faq items={faq} />

        <Cta title="Voyez ce que rapporte vraiment chaque journée">
          WashBoard calcule votre chiffre d&apos;affaires par prestation et par jour, groupe vos
          rendez-vous par secteur et relance vos clients récurrents. Vous savez où vous en êtes sans
          attendre la fin du mois.
        </Cta>

        <AlsoRead
          items={[
            { href: '/blog/tarifs-lavage-auto-domicile', label: 'Quels tarifs pratiquer en lavage auto à domicile' },
            { href: '/blog/organiser-ses-tournees-lavage-auto', label: 'Organiser ses tournées pour laver plus de voitures par jour' },
            { href: '/blog/devenir-laveur-auto-mobile', label: 'Devenir laveur auto mobile : par où commencer' },
          ]}
        />
      </article>
    </>
  )
}

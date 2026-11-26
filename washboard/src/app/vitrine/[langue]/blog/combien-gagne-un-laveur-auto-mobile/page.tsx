import type { Metadata } from 'next'
import { getArticle, SITE_URL } from '@/lib/blog'
import { lienPageMetierTraduit } from '@/lib/metiers'
import { requiredPlanLabel } from '@/lib/plan'
import { H2, H3, P, UL, A, Callout, Table, Summary, Faq, ArticleHeader, Cta, AlsoRead, ArticleJsonLd, type FaqItem } from '@/components/blog/Prose'
import { getTArticle as getT } from '@/lib/i18n/serveur'
import { imagePartage } from '@/lib/imagePartage'
import { alt as altImage } from '@/app/blog/combien-gagne-un-laveur-auto-mobile/opengraph-image'

const article = getArticle('combien-gagne-un-laveur-auto-mobile')!
const url = `${SITE_URL}/blog/${article.slug}`

export const metadata: Metadata = {
  title: `${article.title} | WashBoard`,
  description: article.description,
  alternates: { canonical: url },
  openGraph: {
    images: imagePartage('/blog/combien-gagne-un-laveur-auto-mobile', altImage),
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
    images: imagePartage('/blog/combien-gagne-un-laveur-auto-mobile', altImage),
    card: 'summary_large_image',
    title: article.title,
    description: article.description,
  },
}


export default async function Page() {
  const t = await getT()
  const faq: FaqItem[] = [
    {
      question: t('Combien gagne un laveur auto mobile par mois ?'),
      answer:
        t('En micro-entreprise, un laveur auto mobile à temps plein dégage généralement entre 1 500 et 3 500 € nets par mois selon son organisation : autour de 1 500 à 1 700 € la première année avec 3 véhicules par jour dispersés, 3 000 à 3 500 € une fois installé avec 4 à 5 véhicules par jour groupés par secteur, et jusqu’à 5 000 à 6 000 € avec des clients professionnels et du detailing. Ces chiffres sont après cotisations sociales et charges, avant impôt sur le revenu.'),
    },
    {
      question: t('Quel chiffre d’affaires peut faire un laveur auto à domicile ?'),
      answer:
        t('Entre 2 500 et 6 000 € par mois pour une personne seule en lavage classique. Le plafond vient du temps : à 4 ou 5 véhicules par jour et un panier moyen de 55 à 65 €, on atteint 5 000 à 6 000 € sur 20 jours travaillés. Au-delà, il faut soit monter les prix (detailing, traitements), soit embaucher.'),
    },
    {
      question: t('Le lavage auto mobile est-il rentable ?'),
      answer:
        t('Oui, à condition de tenir trois choses : un tarif calculé sur le temps réel (trajet compris), des rendez-vous groupés par secteur pour limiter la route, et une part de clients récurrents ou professionnels pour lisser l’activité. Un laveur qui accepte tous les clients partout, à bas prix, travaille beaucoup pour un revenu proche du SMIC.'),
    },
    {
      question: t('Combien de voitures faut-il laver par jour pour bien vivre ?'),
      answer:
        t('Quatre par jour, cinq jours par semaine, à un panier moyen de 60 €, donnent environ 4 800 € de chiffre d’affaires mensuel, soit autour de 3 000 € nets en micro-entreprise après cotisations (≈ 22 %) et charges (≈ 650 €), avant impôt. Ce rythme est tenable seulement si les rendez-vous sont groupés géographiquement.'),
    },
  ]

  return (
    <>
      <ArticleJsonLd article={article} siteUrl={SITE_URL} faq={faq} />
      <article>
        <ArticleHeader
          article={article}
          intro={t('Les vidéos qui promettent 5 000 € par mois en lavant des voitures oublient toujours la même ligne : les charges. Voici une simulation honnête, chiffres à l\'appui, et ce qui sépare vraiment un laveur qui vivote d\'un laveur qui vit bien.')}
        />

        <Summary
          items={[
            t('Un laveur auto mobile seul, à temps plein, dégage le plus souvent entre 1 500 et 3 500 € nets par mois — jusqu’à 6 000 € avec des clients pros et du detailing.'),
            t('En lavage classique, le chiffre d’affaires plafonne autour de 5 000 à 6 000 € pour une personne : la limite, c’est le nombre d’heures, pas la demande.'),
            t('Retirez environ 21 à 22 % de cotisations, puis 400 à 700 € de charges mensuelles (véhicule, produits, assurance, téléphone, outils).'),
            t('Trois leviers font monter le revenu : le prix par heure facturée, la densité des tournées, la part de clients récurrents et pros.'),
            t('Les revenus les plus élevés viennent du detailing et des flottes, pas du volume de lavages simples.'),
          ]}
        />

        <P>
          {t('Il n’existe pas de statistique officielle sur le revenu des laveurs mobiles : l’activité est presque toujours exercée en micro-entreprise, et les situations vont du complément de revenu le week-end au temps plein avec des clients d’entreprise. Ce qui suit est construit à partir de ce que nous observons chez les laveurs avec lesquels nous travaillons, et de la grille de')}{' '}
          <A href="/blog/tarifs-lavage-auto-domicile">{t('tarifs pratiqués en France')}</A>.
        </P>

        <H2>{t('D’abord, le plafond : combien d’heures facturables')}</H2>
        <P>
          {t('Le lavage auto se vend au temps. Une personne seule ne peut pas facturer plus d’heures qu’elle n’en a, et elle ne facture jamais toutes celles qu’elle travaille. Sur une journée de 9 heures, entre la route, l’installation, les messages et les trous dans le planning, un laveur bien organisé facture 6 heures. Un laveur mal organisé, 4.')}
        </P>
        <P>
          {t('C’est pour ça que le chiffre d’affaires d’un laveur seul, en lavage classique, dépasse rarement 6 000 € par mois, quelle que soit la demande. Les seuls moyens de passer au-dessus sont de vendre plus cher l’heure (detailing, traitements, rénovation) ou d’embaucher.')}
        </P>

        <H2>{t('Trois profils, trois revenus')}</H2>
        <P>
          {t('Les trois profils ci-dessous travaillent le même nombre de jours (20 par mois). Ce qui change, c’est l’organisation et la clientèle — pas l’effort.')}
        </P>

        <H3>{t('Profil 1 — Première année, clients dispersés')}</H3>
        <P>
          {t('Trois véhicules par jour, souvent éloignés les uns des autres, un panier moyen de 45 € tiré vers le bas par les prix « pour démarrer ». Beaucoup de route, un agenda irrégulier.')}
        </P>

        <H3>{t('Profil 2 — Installé, tournées par secteur')}</H3>
        <P>
          {t('Quatre à cinq véhicules par jour groupés par quartier, un panier moyen de 60 € avec des suppléments (SUV, intérieur encrassé) réellement facturés, et une base de clients récurrents qui remplit un tiers de l’agenda sans prospection.')}
        </P>

        <H3>{t('Profil 3 — Avec clients professionnels et detailing')}</H3>
        <P>
          {t('Deux ou trois journées par semaine chez des garages, concessions ou flottes (plusieurs véhicules au même endroit, zéro trajet), le reste en particuliers avec une offre de detailing ou de traitement céramique qui monte le panier moyen à 80 €.')}
        </P>

        <Table
          head={['', t('Profil 1'), t('Profil 2'), t('Profil 3')]}
          rows={[
            [t('Véhicules par jour'), '3', '4,5', '5,5'],
            [t('Panier moyen'), '45 €', '60 €', '80 €'],
            [t('Chiffre d’affaires mensuel'), '2 700 €', '5 400 €', '8 800 €'],
            [t('Cotisations sociales (≈ 22 %)'), '– 590 €', '– 1 190 €', '– 1 940 €'],
            [t('Charges (véhicule, produits, assurance…)'), '– 450 €', '– 650 €', '– 900 €'],
            [t('Revenu net avant impôt'), '≈ 1 650 €', '≈ 3 550 €', '≈ 5 950 €'],
            [t('Heures travaillées / semaine'), '45 h', '45 h', '48 h'],
          ]}
        />
        <Callout>
          <p>
            <strong>{t('Ces chiffres sont des ordres de grandeur')}</strong>{t(', pas des promesses. Le taux de cotisations dépend de votre situation (ACRE la première année, versement libératoire, etc.), la CFE s’ajoute à partir de la deuxième année, et l’impôt sur le revenu n’est pas déduit. Vérifiez les taux en vigueur sur le site de l’URSSAF.')}
          </p>
        </Callout>
        <P>
          {t('Le point à retenir n’est pas la valeur exacte de chaque case, c’est l’écart entre les colonnes :')} <strong>{t('du simple au triple pour le même nombre d’heures')}</strong>{t('. Personne dans ce tableau ne travaille plus que les autres.')}
        </P>

        <H2>{t('Ce que le chiffre d’affaires ne dit pas : les charges')}</H2>
        <P>
          {t('C’est la ligne que les vidéos oublient. Voici ce qu’un laveur mobile paie chaque mois, même les mois creux :')}
        </P>
        <Table
          head={[t('Poste'), t('Mensuel indicatif')]}
          rows={[
            [t('Véhicule (carburant, entretien, assurance pro)'), '200 – 400 €'],
            [t('Produits et microfibres'), '80 – 200 €'],
            [t('Assurance RC pro avec biens confiés'), '20 – 50 €'],
            [t('Téléphone, logiciel de gestion, site'), '30 – 80 €'],
            [t('Amortissement du matériel'), '30 – 80 €'],
            [t('CFE (à partir de la 2ᵉ année, lissée)'), '20 – 60 €'],
          ]}
        />
        <P>
          {t('Entre 400 et 700 € par mois selon le kilométrage — et le kilométrage dépend directement de la façon dont vous')}{' '}
          <A href="/blog/organiser-ses-tournees-lavage-auto">{t('organisez vos tournées')}</A>{t('. Un laveur qui traverse la ville entre chaque client paie plus de carburant')} <em>{t('et')}</em> {t('facture moins d’heures : la charge monte pendant que le revenu descend.')}
        </P>

        <H2>{t('Les trois leviers qui font vraiment la différence')}</H2>
        <H3>{t('1. Le prix par heure facturée')}</H3>
        <P>
          {t('Pas le prix affiché, le prix par heure réellement passée, trajet compris. Un lavage complet à 70 € qui prend 1 h 30 sur place et 20 minutes de route rapporte 38 € de l’heure. Le même à 55 € avec 45 minutes de route tombe à 24 €. Facturer les suppléments (gabarit, encrassement) et refuser les clients trop loin agit plus vite sur le revenu que n’importe quelle hausse de tarif.')}
        </P>
        <H3>{t('2. La densité des tournées')}</H3>
        <P>
          {t('Passer de 3 à 4,5 véhicules par jour ne demande pas de travailler plus vite : ça demande de mettre les rendez-vous les uns à côté des autres. C’est le levier qui sépare le profil 1 du profil 2, et il ne coûte rien.')}
        </P>
        <H3>{t('3. Les clients récurrents et professionnels')}</H3>
        <P>
          {t('Un particulier fait laver sa voiture trois fois par an. Une flotte de dix véhicules d’entreprise, c’est une journée entière tous les mois, au même endroit, sans prospection. Trois clients de ce type suffisent à lisser un agenda. Comment les trouver est détaillé dans')}{' '}
          <A href="/blog/trouver-des-clients-laveur-auto-mobile">{t('notre guide sur les canaux qui marchent')}</A>.
        </P>
        <P>
          {t('Pour les particuliers, qui reviennent moins souvent, une carte de fidélité donne une raison de rappeler le même laveur. Elle a un coût qu’il faut calculer avant de la lancer : une prestation offerte tous les dix tampons revient à environ 10 % de remise à terme. Voir')}{' '}
          <A href="/blog/carte-de-fidelite-laveur-auto-mobile">{t('le calcul complet')}</A>.
        </P>

        <H2>{t('Et pour dépasser ces chiffres ?')}</H2>
        <P>
          {t('Au-delà de 6 000 € de chiffre d’affaires, une personne seule bute sur le temps. Les laveurs qui vont plus loin font l’un de ces deux choix :')}
        </P>
        <UL>
          <li>
            <strong>{t('Monter en gamme')}</strong>{' '}{t(': detailing, correction de peinture, traitement céramique. Une journée facturée 400 à 700 € au lieu de 300 €, avec moins de véhicules et une clientèle qui ne discute pas le prix.')}
          </li>
          <li>
            <strong>{t('Embaucher ou sous-traiter')}</strong>{' '}{t(': un second laveur sur un second secteur. C’est là que la micro-entreprise atteint sa limite et qu’il faut penser à une société — et à une gestion des plannings qui ne tient plus dans un carnet.')}
          </li>
        </UL>
        <P>
          {t('Dans les deux cas, le préalable est le même : un profil 2 solide, avec des tournées denses, des tarifs tenus et une base de clients qui revient. Sans ça, ni le detailing ni l’embauche ne tiennent.')}
        </P>

        <Faq items={faq} />

        <Cta
          title={t('Voyez ce que rapporte vraiment chaque journée')}
          secondary={lienPageMetierTraduit(t, article.theme)}
        >
          {t('WashBoard suit vos recettes, vos dépenses et votre résultat mois par mois (dès la formule')}{' '}
          {requiredPlanLabel('compta')}{t('), relance vos clients qui ne reviennent pas et, en formule')}{' '}
          {requiredPlanLabel('creneaux_intelligents')}{t(', met en avant les créneaux proches de vos rendez-vous déjà prévus. Vous savez où vous en êtes sans attendre la fin du mois.')}
        </Cta>

        <AlsoRead
          items={[
            { href: '/blog/tarifs-lavage-auto-domicile', label: t('Quels tarifs pratiquer en lavage auto à domicile') },
            { href: '/blog/organiser-ses-tournees-lavage-auto', label: t('Organiser ses tournées pour laver plus de voitures par jour') },
            { href: '/blog/devenir-laveur-auto-mobile', label: t('Devenir laveur auto mobile : par où commencer') },
          ]}
        />
      </article>
    </>
  )
}

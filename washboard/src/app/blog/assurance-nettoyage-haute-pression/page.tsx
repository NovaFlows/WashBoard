import type { Metadata } from 'next'
import { getArticle, SITE_URL } from '@/lib/blog'
import { lienPageMetier } from '@/lib/metiers'
import { H2, P, UL, A, Callout, Table, Summary, Faq, ArticleHeader, Cta, AlsoRead, ArticleJsonLd, type FaqItem } from '@/components/blog/Prose'

const article = getArticle('assurance-nettoyage-haute-pression')!
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
    section: 'Assurance',
  },
  twitter: {
    card: 'summary_large_image',
    title: article.title,
    description: article.description,
  },
}

const faq: FaqItem[] = [
  {
    question: 'La RC pro est-elle obligatoire pour un nettoyage haute pression ?',
    answer:
      'Le nettoyage extérieur (terrasses, façades, toitures) n’est pas une profession réglementée : la RC pro n’y est pas imposée par la loi. Elle est en revanche indispensable en pratique : sans elle, une tuile cassée ou une infiltration après un démoussage sont à ta charge, et la plupart des syndics et des agences immobilières exigent une attestation avant de te confier un contrat.',
  },
  {
    question: 'Le nettoyage d’une toiture est-il couvert par la garantie décennale ?',
    answer:
      'En général non : le démoussage et l’application d’un hydrofuge sont considérés comme de l’entretien courant, exclu du champ de la garantie décennale, laquelle couvre les dommages qui compromettent la solidité ou l’étanchéité d’un ouvrage causés par des travaux de construction. La frontière se déplace si ta prestation s’étend à de la réparation ou à des travaux d’étanchéité : vérifie alors avec ton assureur avant de facturer ce type de mission.',
  },
  {
    question: 'Que couvre la garantie « biens confiés » sur ce métier ?',
    answer:
      'Contrairement au lavage auto, où elle couvre un véhicule, elle doit ici couvrir le bâtiment sur lequel tu interviens : une tuile cassée, une infiltration, un enduit qui se décolle. Le nom exact de cette garantie varie selon les assureurs (« biens confiés élargis », « dommages aux existants ») ; demande explicitement si un dommage au bâtiment lui-même est couvert, pas seulement les objets que tu transportes.',
  },
  {
    question: 'Faut-il une autorisation pour installer un échafaudage sur le trottoir ?',
    answer:
      'Oui. Dès qu’un échafaudage touche ou surplombe le domaine public (trottoir, chaussée), son installation est soumise à une autorisation préalable de la mairie — un permis de stationnement s’il repose simplement au sol, une permission de voirie s’il est ancré. La demande se dépose en général une dizaine de jours avant le montage ; l’installer sans autorisation expose à une amende et peut sortir ton assurance de son cadre en cas d’accident.',
  },
  {
    question: 'Que se passe-t-il si je tombe pendant un chantier en hauteur, en tant qu’indépendant ?',
    answer:
      'Contrairement à un salarié, un indépendant ne bénéficie pas d’un régime accident du travail distinct : une chute est indemnisée comme un arrêt maladie ordinaire, avec un délai de carence de trois jours et une indemnité journalière conditionnée à une durée d’affiliation et à un revenu minimum, plafonnée selon le barème de la Sécurité sociale des indépendants. C’est ce qui pousse beaucoup de professionnels du secteur à souscrire une prévoyance complémentaire dès qu’ils travaillent régulièrement en hauteur.',
  },
  {
    question: 'Combien coûte une assurance pour ce métier ?',
    answer:
      'Il n’existe pas de tarif moyen fiable à citer : le coût dépend de ton chiffre d’affaires déclaré, de la part de toiture dans ton activité, des plafonds choisis et de l’assureur. Le risque étant plus élevé qu’en simple lavage auto (hauteur, dommages potentiels au bâti), les cotisations le sont généralement aussi. Demande plusieurs devis en décrivant précisément ton activité, toiture comprise ou non.',
  },
]

export default function Page() {
  return (
    <>
      <ArticleJsonLd article={article} siteUrl={SITE_URL} faq={faq} />
      <article>
        <ArticleHeader
          article={article}
          intro="Une tuile cassée ne se voit pas tout de suite ; une infiltration, encore moins. Le nettoyage haute pression déplace le risque du véhicule vers le bâtiment, et rien ne te prévient que ton contrat d'assurance ne suit pas automatiquement ce changement. Voici ce qui change par rapport à une simple assurance de lavage, ce que couvre — ou non — ta RC pro sur un toit, et ce que la Sécu ne rembourse pas si tu tombes."
        />

        <Summary
          items={[
            'La RC pro n’est pas obligatoire légalement pour ce métier, mais elle est en pratique indispensable, et les syndics comme les agences l’exigent presque toujours avant de signer.',
            'La garantie « biens confiés » doit ici couvrir le bâtiment (tuile, façade, gouttière), pas seulement un objet transporté — vérifie que le contrat le dit explicitement.',
            'Un échafaudage qui touche ou surplombe le trottoir se déclare en mairie avant le montage (autorisation de voirie) : l’oublier expose à une amende, et parfois à sortir du cadre de l’assurance.',
            'Démoussage et hydrofuge sont en général de l’entretien courant, hors garantie décennale — la frontière change si la prestation devient de la réparation ou de l’étanchéité.',
            'Un indépendant n’a pas de régime accident du travail : une chute est indemnisée comme une maladie ordinaire, avec un délai de carence et une condition de revenu.',
          ]}
        />

        <Callout>
          <p>
            <strong>Cet article n&apos;est pas un conseil d&apos;assurance.</strong>{' '}Les garanties,
            exclusions et tarifs varient d&apos;un assureur à l&apos;autre et changent dans le temps.
            Il te donne les points à vérifier dans ton contrat ; c&apos;est le contrat, et lui
            seul, qui fait foi. Faites confirmer chaque point par écrit avant de signer.
          </p>
        </Callout>

        <H2>Les contrats à connaître pour ce métier</H2>
        <Table
          head={['Contrat', 'Ce qu’il couvre ici', 'Indispensable ?']}
          rows={[
            ['RC professionnelle + biens confiés', 'Dommages au client, aux tiers, et au bâtiment sur lequel tu interviens (tuile, façade, gouttière)', 'Oui'],
            ['Assurance du véhicule à usage pro', 'Ton véhicule et le matériel à bord (nettoyeur, tuyaux, produits) pendant les tournées', 'Oui'],
            ['Protection juridique', 'Les frais en cas de litige avec un client, un syndic ou un voisin', 'Recommandée'],
            ['Garantie décennale', 'Les dommages qui compromettent la solidité ou l’étanchéité d’un ouvrage — rarement engagée pour du nettoyage, à vérifier si ton offre s’étend à la réparation', 'Selon l’activité'],
            ['Prévoyance / garantie accidents de la vie', 'Un revenu ou un capital si tu tombes et ne peux plus travailler', 'À envisager dès le premier chantier en hauteur'],
          ]}
        />

        <H2>1. Le risque a changé de nature</H2>
        <P>
          Sur une voiture, le pire scénario est un cuir taché ou une carrosserie rayée : quelques
          centaines d&apos;euros, rarement plus. Sur un chantier extérieur, le pire scénario touche
          le bâtiment lui-même — et l&apos;écart de coût change ce que doit couvrir ton contrat.
        </P>
        <Table
          head={['Dommage', 'Coût de réparation (ordre de grandeur)', 'Qui doit te couvrir']}
          rows={[
            ['Tuile cassée en marchant sur le toit', '15 – 40 € la tuile, plus la main-d’œuvre d’un couvreur', 'Biens confiés, plafond par sinistre'],
            ['Infiltration après un démoussage trop agressif', 'Plusieurs milliers d’euros (isolant, plafond intérieur)', 'Biens confiés, avec un plafond qui suit'],
            ['Enduit ou peinture de façade qui se décolle sous la pression', '1 000 à plusieurs milliers d’euros de reprise', 'Biens confiés + dommages aux existants'],
            ['Vitre ou carrosserie du voisin touchée par une projection', 'Quelques centaines d’euros, plus la franchise', 'RC pro « dommages aux tiers »'],
            ['Chute du prestataire depuis un toit ou un échafaudage', 'Arrêt de travail, frais médicaux', 'Toi : prévoyance, pas la RC pro'],
          ]}
        />
        <P>
          Ces chiffres sont des ordres de grandeur, pas des moyennes mesurées : ils varient selon la
          région, le support et l&apos;ampleur du dégât. Ce qui abîme un support et comment l&apos;éviter
          est détaillé dans{' '}
          <A href="/blog/nettoyage-haute-pression-terrasses-facades-toitures">
            notre article sur le nettoyage haute pression
          </A>
          . La question ici est différente : qui paie, et jusqu&apos;à quel montant, quand le dégât
          arrive quand même.
        </P>

        <H2>2. La garantie « biens confiés » : penser bâtiment, pas objet</H2>
        <P>
          Beaucoup de contrats RC pro pensés pour les services à la personne définissent les
          « biens confiés » comme des objets mobiliers — un peu comme une voiture. Un bâtiment est
          un bien immobilier, et certains contrats ne l&apos;incluent pas automatiquement dans cette
          garantie. Le nom exact varie selon les assureurs : « biens confiés élargis », « dommages
          aux existants », parfois une clause spécifique de la responsabilité civile exploitation.
          Le nom importe moins que le contenu :
        </P>
        <UL>
          <li>
            <strong>Le plafond par sinistre.</strong>{' '}Il doit couvrir la reprise d&apos;une façade
            ou l&apos;étanchéité d&apos;une toiture — plusieurs milliers d&apos;euros, pas seulement
            quelques centaines comme pour une carrosserie.
          </li>
          <li>
            <strong>La franchise.</strong>{' '}Ce qui reste à ta charge à chaque sinistre, souvent
            plus élevée sur ce type de contrat que sur une RC pro de lavage auto.
          </li>
          <li>
            <strong>Le plafond annuel.</strong>{' '}Le total que l&apos;assureur paiera sur
            l&apos;année, tous sinistres confondus.
          </li>
          <li>
            <strong>L&apos;étendue exacte de la garantie.</strong>{' '}Couvre-t-elle seulement
            l&apos;élément sur lequel tu travaillais (la partie de toiture démoussée), ou aussi les
            dommages induits ailleurs — l&apos;infiltration qui abîme un plafond intérieur, deux
            pièces plus loin ? C&apos;est souvent là que se joue un refus d&apos;indemnisation.
          </li>
        </UL>

        <H2>3. L&apos;échafaudage et la hauteur : une autorisation, pas seulement un harnais</H2>
        <P>
          L&apos;équipement de sécurité en hauteur — harnais, ligne de vie, échafaudage — est
          couvert dans{' '}
          <A href="/blog/nettoyage-haute-pression-terrasses-facades-toitures">
            notre article sur le nettoyage haute pression
          </A>
          . Un point que les laveurs qui démarrent ignorent souvent : dès qu&apos;un échafaudage
          touche ou surplombe le domaine public (trottoir, chaussée), son installation est soumise à
          une autorisation préalable de la mairie — un permis de stationnement s&apos;il repose
          simplement au sol, une permission de voirie s&apos;il est ancré. La demande se dépose en
          général une dizaine de jours avant le montage. L&apos;installer sans autorisation expose à
          une amende et, souvent, à sortir du cadre couvert par l&apos;assurance si un passant est
          blessé.
        </P>
        <P>
          Si tu loues une nacelle ou un échafaudage plutôt que de l&apos;acheter, vérifie qui
          assure quoi : le contrat de location précise en général si le loueur couvre l&apos;engin
          lui-même, et te laisse la responsabilité de son usage. Ne pars pas du principe que la
          location inclut une assurance de ton activité.
        </P>

        <H2>4. La décennale : pourquoi elle ne s&apos;applique presque jamais ici (et quand ça change)</H2>
        <P>
          La garantie décennale couvre les dommages qui compromettent la solidité d&apos;un ouvrage
          ou le rendent impropre à sa destination, causés par des travaux de construction ou de
          rénovation. Le nettoyage, le démoussage et l&apos;application d&apos;un hydrofuge sont, en
          général, considérés comme de l&apos;entretien courant : ils en sont donc exclus, comme le
          sont d&apos;ailleurs les dégâts causés par un défaut d&apos;entretien du côté du
          propriétaire.
        </P>
        <P>
          La frontière se déplace si ton offre s&apos;étend à de la réparation — remplacement de
          tuiles, reprise d&apos;étanchéité. Ce type de prestation s&apos;apparente alors à des
          travaux du bâtiment, et l&apos;assureur peut exiger une garantie décennale avant de te
          couvrir. Si tu envisages d&apos;aller au-delà du nettoyage et du traitement, pose la
          question à ton assureur avant de facturer la première prestation de ce type.
        </P>

        <H2>5. Toi, en cas de chute : ce que couvre la Sécu, ce qu&apos;elle ne couvre pas</H2>
        <P>
          Un salarié qui tombe sur un chantier relève du régime accident du travail : prise en
          charge des soins, indemnités journalières dès le lendemain, sans condition de revenu
          minimal. Un indépendant — auto-entrepreneur ou non — n&apos;a pas ce régime distinct. Une
          chute est indemnisée comme n&apos;importe quel arrêt maladie : un délai de carence de
          trois jours, une indemnité journalière conditionnée à une durée d&apos;affiliation et à un
          revenu annuel moyen suffisant, et un montant plafonné qui évolue chaque année selon le
          barème de la Sécurité sociale des indépendants. Ce n&apos;est pas rien, mais ce n&apos;est
          pas non plus un revenu de remplacement si l&apos;arrêt dure plusieurs mois.
        </P>
        <P>
          C&apos;est ce qui pousse beaucoup de laveurs qui travaillent en hauteur à souscrire une
          prévoyance ou une garantie accidents de la vie en complément : un capital ou un revenu
          additionnel en cas d&apos;incapacité, sur un métier où l&apos;arrêt peut durer plus
          longtemps qu&apos;une entorse. Le tarif dépend de ton âge et de ton état de santé
          déclaré ; compare plusieurs devis plutôt que de te fier au premier proposé.
        </P>

        <H2>Avant de signer : la liste des questions</H2>
        <P>
          Pose-les par écrit et garde les réponses. Un assureur sérieux y répond sans détour.
        </P>
        <UL>
          <li>
            Un dommage causé au bâtiment sur lequel j&apos;interviens (toiture, façade, gouttière)
            est-il couvert, y compris s&apos;il apparaît plusieurs semaines après (infiltration) ?
          </li>
          <li>Le nettoyeur haute pression et les produits appliqués sont-ils explicitement couverts ?</li>
          <li>Suis-je couvert si j&apos;installe un échafaudage sur le trottoir, avec l&apos;autorisation de la mairie ?</li>
          <li>Le contrat prévoit-il la garantie décennale, ou dois-je la souscrire séparément si j&apos;ajoute de la réparation à mon offre ?</li>
          <li>Que se passe-t-il si un objet ou un outil tombe et blesse un passant ?</li>
          <li>Le contrat évolue-t-il si je monte en hauteur plus souvent, ou si j&apos;embauche ?</li>
        </UL>
        <P>
          Ces vérifications prennent une heure. C&apos;est l&apos;heure la mieux investie avant un
          chantier en hauteur : elle protège ton matériel, le bâtiment de ton client, et toi.
        </P>

        <Faq items={faq} />

        <Cta
          title="Chaque chantier, avec l'adresse et l'historique sous la main"
          secondary={lienPageMetier(article.theme)}
        >
          Avec WashBoard, chaque rendez-vous garde l&apos;adresse du chantier, la prestation choisie
          et l&apos;heure. Le jour où un syndic demande une preuve d&apos;intervention, ou où un
          dommage est signalé après coup, tu retrouves l&apos;historique complet depuis ton
          téléphone.
        </Cta>

        <AlsoRead
          items={[
            { href: '/blog/nettoyage-haute-pression-terrasses-facades-toitures', label: 'Nettoyage haute pression à domicile : terrasses, façades, toitures' },
            { href: '/blog/assurance-laveur-auto-mobile', label: 'Quelle assurance pour un laveur auto mobile' },
            { href: '/blog/tarifs-lavage-auto-domicile', label: 'Quels tarifs pratiquer en lavage auto à domicile' },
          ]}
        />
      </article>
    </>
  )
}

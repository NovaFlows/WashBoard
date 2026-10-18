import type { Metadata } from 'next'
import { getArticle, SITE_URL } from '@/lib/blog'
import { lienPageMetier } from '@/lib/metiers'
import { PLAN_CARDS, requiredPlan, requiredPlanLabel } from '@/lib/plan'
import { tarifOffre } from '@/lib/resumeOffres'
import { H2, P, UL, A, Callout, Table, Summary, Faq, ArticleHeader, Cta, AlsoRead, ArticleJsonLd, type FaqItem } from '@/components/blog/Prose'

const article = getArticle('micro-entreprise-laveur-auto-mobile')!
const url = `${SITE_URL}/blog/${article.slug}`

// Offre qui ouvre la facturation : nom et tarif lus dans plan.ts, jamais recopiés.
const offreFacturation = PLAN_CARDS.find(c => c.key === requiredPlan('facturation'))!

// Chiffres de cet article : uniquement ceux lus sur les pages officielles citées en bas
// d'article (Service-Public, Insee), consultées le 2026-10-18. Taux, plafonds et seuils
// changent : à relire à chaque début d'année.

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
    section: 'Se lancer',
  },
  twitter: { card: 'summary_large_image', title: article.title, description: article.description },
}

const faq: FaqItem[] = [
  {
    question: 'Quel est le code APE d’un laveur auto mobile ?',
    answer:
      'L’Insee rattache le lavage, le nettoyage et le lustrage de véhicules automobiles à la sous-classe 45.20A de la NAF rév. 2, « Entretien et réparation de véhicules automobiles légers ». C’est l’Insee qui attribue le code à l’immatriculation, d’après l’activité que vous déclarez : vous le trouvez, avec votre SIREN, sur votre attestation d’immatriculation. La NAF 2025 entre en vigueur en janvier 2027 : la numérotation pourra alors évoluer.',
  },
  {
    question: 'Quel taux de cotisations pour un laveur auto en micro-entreprise ?',
    answer:
      'Selon Service-Public (pages vérifiées en 2026), les prestations de services relevant des BIC sont à 21,2 % du chiffre d’affaires, ou 22,9 % avec le versement libératoire de l’impôt sur le revenu. Les cotisations se calculent sur le chiffre d’affaires déclaré, sans déduction de vos frais.',
  },
  {
    question: 'Quel plafond de chiffre d’affaires pour un laveur auto en micro-entreprise ?',
    answer:
      'Pour les prestations de services, le plafond de la micro-entreprise est de 83 600 € en 2026 selon Service-Public. Le franchir une seule année ne vous fait pas quitter le régime : il faut le dépasser deux années de suite. La franchise de TVA a ses propres seuils, plus bas : 37 500 € et 41 250 € pour les prestations de services.',
  },
  {
    question: 'Faut-il facturer la TVA quand on est laveur auto en micro-entreprise ?',
    answer:
      'Tant que votre chiffre d’affaires reste sous les seuils de la franchise en base (37 500 €, ou 41 250 € en cours d’année pour les prestations de services, d’après Service-Public), vous ne facturez pas de TVA et vous le mentionnez sur vos factures. Au-delà de 41 250 €, la TVA s’applique dès le jour du dépassement.',
  },
  {
    question: 'Combien coûte la création d’une micro-entreprise ?',
    answer:
      'L’immatriculation est gratuite dans la plupart des cas, d’après Service-Public : elle se fait en ligne sur le guichet des formalités des entreprises, au plus tôt un mois avant le début de l’activité et au plus tard 15 jours après. Méfiez-vous des sites privés qui facturent cette démarche.',
  },
]

export default function Page() {
  return (
    <>
      <ArticleJsonLd article={article} siteUrl={SITE_URL} faq={faq} />
      <article>
        <ArticleHeader
          article={article}
          intro="Avant le premier lavage, trois questions reviennent : quel code APE, combien de cotisations, quelles démarches. Les réponses sont publiques, mais éparpillées sur plusieurs sites. Voici ce qui concerne un laveur auto mobile, avec la source officielle et son année pour chaque chiffre."
        />

        <Summary
          items={[
            'La micro-entreprise est le régime le plus courant pour démarrer le lavage auto à domicile : les cotisations sont un pourcentage du chiffre d’affaires, donc nulles tant que vous ne facturez rien.',
            'Pour une prestation de services en BIC, Service-Public indique 21,2 % de cotisations en 2026, et un plafond de chiffre d’affaires de 83 600 €.',
            'Le code APE n’est pas à choisir : l’Insee l’attribue. Pour le lavage de véhicules, il rattache le produit à la sous-classe 45.20A.',
            'La franchise de TVA a des seuils plus bas que le plafond de la micro-entreprise (37 500 € / 41 250 €) : c’est eux que vous franchirez en premier.',
            'Ce qui ne marche pas : confondre chiffre d’affaires et revenu, dépenser les cotisations avant de les payer, et se fier à un article plutôt qu’à la page officielle.',
          ]}
        />

        <P>
          Les chiffres de cet article viennent de pages officielles, citées en bas avec leur date
          de vérification. Aucun n&apos;est une estimation de WashBoard : s&apos;ils changent,
          c&apos;est la page officielle qui fait foi. Si vous en êtes encore à vous demander si le métier vous convient,
          commencez par{' '}
          <A href="/blog/devenir-laveur-auto-mobile">devenir laveur auto mobile : par où commencer</A>.
        </P>

        <H2>Pourquoi la micro-entreprise pour démarrer</H2>
        <P>
          La micro-entreprise est un régime simplifié : vous déclarez votre chiffre d&apos;affaires,
          chaque mois ou chaque trimestre selon l&apos;option choisie, et vos cotisations sociales en
          sont un pourcentage. Pas de chiffre d&apos;affaires, pas de cotisation : pour quelqu&apos;un
          qui démarre avec trois clients, c&apos;est le seul régime où l&apos;on ne paie pas pour un
          mois où rien n&apos;est rentré.
        </P>
        <P>
          Le revers : ce pourcentage s&apos;applique au chiffre d&apos;affaires, sans déduire vos
          frais. Le carburant, les produits, l&apos;usure du matériel sont à votre charge, même s&apos;ils
          sont élevés. Le{' '}
          <A href="/blog/combien-gagne-un-laveur-auto-mobile">calcul de revenu d&apos;un laveur auto</A>{' '}
          montre ce que cela change sur trois profils.
        </P>

        <H2>Les cotisations : ce que vous payez vraiment</H2>
        <P>
          Pour les prestations de services en BIC (bénéfices industriels et commerciaux), Service-Public
          indique un taux de cotisations sociales de 21,2 % du chiffre d&apos;affaires (page « Régime
          micro-social », vérifiée le 21 février 2026). Avec l&apos;option du versement libératoire de
          l&apos;impôt sur le revenu, l&apos;Urssaf collecte aussi l&apos;impôt et le taux appliqué devient
          22,9 % (page « Cotisations sociales d&apos;un micro-entrepreneur », vérifiée le 1er janvier
          2026). Voici ce que cela donne en euros, à titre de calcul :
        </P>
        <Table
          head={['Chiffre d’affaires du mois', 'Cotisations à 21,2 %', 'Avec versement libératoire (22,9 %)', 'Reste avant vos frais']}
          rows={[
            ['1 500 €', '318 €', '343,50 €', '1 182 € ou 1 156,50 €'],
            ['3 000 €', '636 €', '687 €', '2 364 € ou 2 313 €'],
            ['5 000 €', '1 060 €', '1 145 €', '3 940 € ou 3 855 €'],
          ]}
        />
        <P>
          Ces montants sont des multiplications, pas des simulations : ils ne tiennent compte ni de
          vos frais, ni de l&apos;impôt sur le revenu (sauf dans la colonne du versement libératoire),
          ni de l&apos;éventuelle aide de début d&apos;activité.
        </P>

        <H2>L&apos;aide de début d&apos;activité (Acre)</H2>
        <P>
          Les créateurs peuvent bénéficier d&apos;un taux de cotisations minoré à 75 % du taux normal,
          soit 25 % de moins (21,2 % deviennent 15,9 %). D&apos;après la page Service-Public de l&apos;Acre
          (vérifiée le 1er juillet 2026), elle n&apos;est plus automatique depuis le 1er janvier 2026 : il
          faut la demander à l&apos;Urssaf dans les 60 jours qui suivent la date d&apos;ouverture de
          l&apos;activité, et elle court jusqu&apos;à la fin du 3e trimestre civil qui suit cette date.
          Conséquence pratique, relevée par la page elle-même : démarrer en début de trimestre permet
          d&apos;en profiter plus longtemps.
        </P>

        <H2>Les plafonds : micro-entreprise et franchise de TVA</H2>
        <P>
          Deux limites distinctes, et la plus basse est celle que vous franchirez d&apos;abord.
        </P>
        <Table
          head={['Limite', 'Montant (prestations de services)', 'Ce qui se passe au-delà']}
          rows={[
            ['Plafond de la micro-entreprise, 2026', '83 600 €', 'Vous quittez le régime si vous dépassez deux années consécutives, au 1er janvier suivant. Un dépassement isolé ne suffit pas.'],
            ['Franchise de TVA, seuil de base', '37 500 € (chiffre d’affaires de l’année précédente)', 'La TVA s’applique à partir du 1er janvier de l’année suivante.'],
            ['Franchise de TVA, seuil majoré', '41 250 € (chiffre d’affaires de l’année en cours)', 'La TVA s’applique dès le premier jour du dépassement.'],
          ]}
        />
        <P>
          En moyenne mensuelle, 37 500 € font environ 3 125 € de chiffre d&apos;affaires, et 83 600 €
          environ 6 970 € (division par 12, pas une prévision). Un laveur installé avec des clients
          professionnels peut donc dépasser la franchise de TVA bien avant le plafond de la
          micro-entreprise : voir{' '}
          <A href="/blog/lavage-flotte-vehicules-entreprise">laver pour les entreprises</A>{' '}
          pour ce que change la TVA face à un client professionnel. Sources : pages « Régime micro-social »
          (vérifiée le 21 février 2026), « Franchise en base de TVA » (vérifiée le 1er janvier 2026)
          et « Régime de la micro-entreprise » (vérifiée le 21 février 2026).
        </P>
        <Callout>
          <p>
            <strong>Si vous cumulez plusieurs activités</strong>{' '}(le lavage auto et le ménage, par
            exemple), Service-Public précise que le plafond global et celui de chaque activité
            doivent être respectés. Déclarez chaque activité séparément.
          </p>
        </Callout>

        <H2>Le code APE du lavage auto</H2>
        <P>
          Le code APE n&apos;est pas un choix. Il est attribué par l&apos;Insee à votre immatriculation,
          d&apos;après l&apos;activité que vous déclarez, et vous le recevez avec votre numéro SIREN
          sur votre attestation d&apos;immatriculation (page Service-Public « formalités d&apos;immatriculation
          d&apos;une micro-entreprise », vérifiée le 18 mars 2026).
        </P>
        <P>
          Pour le lavage de véhicules, la nomenclature de l&apos;Insee est un peu indirecte. La note
          explicative de la sous-classe <strong>45.20A</strong>{' '}(« Entretien et réparation de véhicules
          automobiles légers ») ne cite pas le lavage, mais la liste de ses produits associés contient le
          code 45.20.30 : « Lavage, nettoyage et lustrage de véhicules automobiles ». C&apos;est
          donc vers 45.20A que l&apos;Insee oriente cette activité (nomenclature NAF rév. 2, consultée
          en octobre 2026). Autres points à connaître :
        </P>
        <UL>
          <li>l&apos;Insee indique que la NAF rév. 2 est en vigueur jusqu&apos;à la fin 2026 et que la NAF 2025 entrera en vigueur en janvier 2027 : le numéro de votre code pourra changer sans que votre activité change ;</li>
          <li>si le code ne correspond pas à ce que vous faites, le site de l&apos;Insee propose une demande de modification du code APE ;</li>
          <li>ce que vous avez déclaré au guichet des formalités compte plus que le code : décrivez votre activité réelle (lavage de véhicules à domicile) plutôt qu&apos;une formule vague.</li>
        </UL>

        <H2>Les démarches, dans l&apos;ordre</H2>
        <UL>
          <li>
            <strong>Fixer votre date de début.</strong>{' '}La demande se fait au plus tôt un mois avant
            le début d&apos;activité, et au plus tard dans les 15 jours qui suivent. Cette date
            détermine aussi la durée de l&apos;Acre.
          </li>
          <li>
            <strong>Déclarer l&apos;activité en ligne.</strong>{' '}Sur le guichet des formalités des
            entreprises, gratuit dans la plupart des cas. Il demande un justificatif de domiciliation,
            une copie de pièce d&apos;identité, une déclaration sur l&apos;honneur de non-condamnation et
            une attestation de filiation.
          </li>
          <li>
            <strong>Récupérer votre attestation</strong>{' '}avec votre SIREN et votre code APE. Le
            Le SIRET (le SIREN suivi du numéro d&apos;établissement) est celui qui s&apos;écrit sur vos devis et factures.
          </li>
          <li>
            <strong>Demander l&apos;Acre</strong>{' '}à l&apos;Urssaf, dans les 60 jours, si vous y avez
            droit.
          </li>
          <li>
            <strong>Vous assurer</strong>{' '}avant la première prestation : voir{' '}
            <A href="/blog/assurance-laveur-auto-mobile">quelle assurance pour un laveur auto mobile</A>.
          </li>
          <li>
            <strong>Facturer correctement</strong>{' '}dès le premier client : numéro de facture, SIRET,
            mention « EI », mention de franchise de TVA. Les détails sont dans{' '}
            <A href="/blog/devis-lavage-auto-domicile">faire un devis de lavage auto à domicile</A>{' '}
            et sur la page{' '}
            <A href="/facturation-laveur-auto">facturation pour laveur auto mobile</A>.
          </li>
        </UL>

        <H2>Ce qui ne marche pas</H2>
        <UL>
          <li>
            <strong>Confondre chiffre d&apos;affaires et revenu.</strong>{' '}3 000 € de chiffre
            d&apos;affaires, ce n&apos;est pas 3 000 € dans votre poche : retirez 636 € de cotisations,
            puis vos produits, votre carburant, votre assurance et l&apos;usure du matériel.
          </li>
          <li>
            <strong>Dépenser les cotisations avant de les payer.</strong>{' '}Elles sont dues sur le
            chiffre d&apos;affaires déclaré, à échéance fixe. Mettez de côté le taux qui vous concerne (21,2 % ou 22,9 %) sur chaque
            encaissement, le jour même.
          </li>
          <li>
            <strong>Oublier la franchise de TVA.</strong>{' '}Le seuil de 37 500 € arrive vite avec une
            clientèle professionnelle, et au-delà de 41 250 € la TVA s&apos;applique dès le jour du
            dépassement, sur des prix que vous avez déjà donnés.
          </li>
          <li>
            <strong>Prendre le versement libératoire sans calcul.</strong>{' '}Il remplace l&apos;impôt sur
            le revenu à taux fixe : pour certains, c&apos;est un gain, pour d&apos;autres une perte. Vérifiez
            les conditions sur le site de l&apos;Urssaf avant de cocher la case : cet article ne les
            détaille pas.
          </li>
          <li>
            <strong>Se fier à un article, y compris celui-ci.</strong>{' '}Taux, plafonds et Acre ont
            changé en 2026. Relisez les pages officielles listées ci-dessous au moment où vous vous
            lancez.
          </li>
        </UL>

        <H2>Sources officielles</H2>
        <UL>
          <li><a className="pr-a" href="https://entreprendre.service-public.gouv.fr/vosdroits/F37353">Service-Public, « Régime micro-social »</a>{' '}(vérifiée le 21 février 2026) : taux par activité et plafond de 83 600 €.</li>
          <li><a className="pr-a" href="https://entreprendre.service-public.gouv.fr/vosdroits/F36232">Service-Public, « Cotisations sociales d’un micro-entrepreneur »</a>{' '}(vérifiée le 1er janvier 2026) : 21,2 %, 22,9 % avec versement libératoire, déclaration mensuelle ou trimestrielle.</li>
          <li><a className="pr-a" href="https://entreprendre.service-public.gouv.fr/vosdroits/F32353">Service-Public, « Régime de la micro-entreprise »</a>{' '}(vérifiée le 21 février 2026) : dépassement sur deux années consécutives.</li>
          <li><a className="pr-a" href="https://entreprendre.service-public.gouv.fr/vosdroits/F21746">Service-Public, « Franchise en base de TVA »</a>{' '}(vérifiée le 1er janvier 2026) : seuils de 37 500 € et 41 250 €.</li>
          <li><a className="pr-a" href="https://entreprendre.service-public.gouv.fr/vosdroits/F11677">Service-Public, « Acre »</a>{' '}(vérifiée le 1er juillet 2026) : taux minoré et délai de demande.</li>
          <li><a className="pr-a" href="https://entreprendre.service-public.gouv.fr/vosdroits/F36746">Service-Public, « Formalités d’immatriculation d’une micro-entreprise »</a>{' '}(vérifiée le 18 mars 2026) : guichet en ligne, délais, pièces, attestation.</li>
          <li><a className="pr-a" href="https://www.insee.fr/fr/metadonnees/nafr2/sousClasse/45.20A">Insee, NAF rév. 2, sous-classe 45.20A</a>{' '}et la <a className="pr-a" href="https://www.insee.fr/fr/information/2406147">page de présentation des nomenclatures</a>{' '}(consultées en octobre 2026).</li>
        </UL>

        <Faq items={faq} />

        <Cta
          title="Vos factures et vos recettes, sans y repenser"
          secondary={lienPageMetier(article.theme)}
        >
          Avec WashBoard, en formule {requiredPlanLabel('facturation')} ({tarifOffre(offreFacturation)}),
          vous renseignez une fois votre statut, votre SIRET et votre régime de TVA : la facture est
          créée à la fin de chaque rendez-vous, avec la mention « EI » ajoutée à votre nom légal, une
          numérotation continue et votre franchise de TVA ou votre taux. Les prestations terminées
          alimentent vos recettes en formule {requiredPlanLabel('compta')}, lisibles mois par
          mois. WashBoard ne calcule ni ne déclare vos
          cotisations : cela reste à faire sur le site de l&apos;Urssaf.
        </Cta>

        <AlsoRead
          items={[
            { href: '/blog/devenir-laveur-auto-mobile', label: 'Devenir laveur auto mobile : par où commencer' },
            { href: '/blog/combien-gagne-un-laveur-auto-mobile', label: 'Combien gagne un laveur auto mobile ? Revenus réels et simulation' },
            { href: '/blog/assurance-laveur-auto-mobile', label: 'Quelle assurance pour un laveur auto mobile' },
            { href: '/blog/devis-lavage-auto-domicile', label: 'Faire un devis de lavage auto à domicile : modèle, mentions, durée de validité' },
          ]}
        />
      </article>
    </>
  )
}

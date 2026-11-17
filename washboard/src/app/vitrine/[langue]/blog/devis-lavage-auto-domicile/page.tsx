import type { Metadata } from 'next'
import { getArticle, SITE_URL } from '@/lib/blog'
import { lienPageMetierTraduit } from '@/lib/metiers'
import { PLAN_CARDS, requiredPlan, requiredPlanLabel } from '@/lib/plan'
import { VALIDITE_DEVIS_JOURS } from '@/lib/documents'
import { tarifOffre } from '@/lib/resumeOffres'
import { H2, P, UL, A, Table, Summary, Faq, ArticleHeader, Cta, AlsoRead, ArticleJsonLd, type FaqItem } from '@/components/blog/Prose'
import { getTArticle as getT } from '@/lib/i18n/serveur'
import { imagePartage } from '@/lib/imagePartage'
import { alt as altImage } from '@/app/blog/devis-lavage-auto-domicile/opengraph-image'

const article = getArticle('devis-lavage-auto-domicile')!
const url = `${SITE_URL}/blog/${article.slug}`

// Offre qui ouvre les devis (même palier que la facturation) : nom et tarif lus dans
// plan.ts, jamais recopiés.
const offreDevis = PLAN_CARDS.find(c => c.key === requiredPlan('facturation'))!

export const metadata: Metadata = {
  title: `${article.title} | WashBoard`,
  description: article.description,
  alternates: { canonical: url },
  openGraph: {
    images: imagePartage('/blog/devis-lavage-auto-domicile', altImage),
    type: 'article',
    url,
    title: article.title,
    description: article.description,
    publishedTime: article.publishedAt,
    modifiedTime: article.updatedAt,
    authors: ['WashBoard'],
    section: 'Facturer',
  },
  twitter: { images: imagePartage('/blog/devis-lavage-auto-domicile', altImage), card: 'summary_large_image', title: article.title, description: article.description },
}


export default async function Page() {
  const t = await getT()
  const faq: FaqItem[] = [
    {
      question: t('Quelle durée de validité mettre sur un devis de lavage auto ?'),
      answer:
        t('Elle doit figurer sur le devis, sinon votre prix vous engage sans limite. Un mois est un repère courant, et c’est {jours} jours dans WashBoard par défaut. Raccourcissez-la si vos prix ou votre planning bougent vite, allongez-la pour un contrat saisonnier.', { jours: VALIDITE_DEVIS_JOURS }),
    },
    {
      question: t('Que faut-il écrire sur un devis de lavage auto ?'),
      answer:
        t('La date et un numéro, vos coordonnées, celles du client et le lieu de la prestation, le détail ligne par ligne (ce qui est inclus, et ce qui ne l’est pas), le total et la durée de validité. Plus le détail est précis, moins il y a de discussion devant la voiture.'),
    },
    {
      question: t('Un devis accepté doit-il être signé ?'),
      answer:
        t('Un devis n’engage les parties qu’une fois accepté. Une signature datée avec la mention « Bon pour accord », ou une acceptation écrite par message, vous donne une trace en cas de désaccord sur le prix. Gardez la réponse du client avec le devis.'),
    },
    {
      question: t('Peut-on transformer un devis en facture ?'),
      answer:
        t('Oui, et c’est son intérêt : une fois la prestation faite, la facture reprend le client, les lignes et la remise du devis accepté, avec la date de la prestation. Avec WashBoard, un devis accepté se transforme en facture d’un tap, et la facture prend le numéro suivant de votre suite.'),
    },
  ]

  return (
    <>
      <ArticleJsonLd article={article} siteUrl={SITE_URL} faq={faq} />
      <article>
        <ArticleHeader
          article={article}
          intro={t('« Ça ferait combien ? » est la question qui précède presque toute prestation qui sort de l’ordinaire. Un devis écrit répond avant que le malentendu naisse. Voici quand il vaut la peine, ce qu’il doit dire, quelle durée de validité choisir, et un modèle à recopier.')}
        />

        <Summary
          items={[
            t('Un devis sert dès que le prix sort de votre grille : véhicule très sale, plusieurs véhicules, client professionnel.'),
            t('Il doit dire précisément ce qui est inclus (et ce qui ne l’est pas), le total et jusqu’à quand le prix tient.'),
            t('La durée de validité est libre mais indispensable : {jours} jours est un bon point de départ, plus court si vos prix bougent.', { jours: VALIDITE_DEVIS_JOURS }),
            t('Un devis vaut ce que vaut sa précision : « lavage complet » sans contenu ne protège de rien.'),
            t('Ce qui ne marche pas : le devis flou, le devis sans date de fin, le devis qu’on ne relance jamais et le prix qu’on change après accord.'),
          ]}
        />

        <P>
          {t('Un client qui réserve un lavage à votre tarif affiché n’a pas besoin de devis : le prix est écrit sur la page de réservation, il l’a accepté en cliquant. Le devis devient utile quand la prestation n’a pas de prix catalogue, et c’est justement là que naissent les litiges.')}
        </P>

        <H2>{t('Quand faire un devis, et quand s’en passer')}</H2>
        <P>
          {t('Un devis a un coût : du temps pour l’écrire, et un client qui peut lire votre prix tranquillement et le comparer. Il se justifie quand le risque d’un malentendu est plus grand que ce coût :')}
        </P>
        <UL>
          <li>{t('un véhicule très sale ou une remise en état (poils d’animaux, taches anciennes, désodorisation) dont la durée est difficile à prévoir ;')}</li>
          <li>{t('plusieurs véhicules d’un même client, surtout une entreprise (voir')} <A href="/blog/lavage-flotte-vehicules-entreprise">{t('laver pour les entreprises')}</A>) ;</li>
          <li>{t('une prestation hors grille : rénovation de sièges, traitement céramique, intervention récurrente à tarif négocié ;')}</li>
          <li>{t('un client qui demande un prix avant de s’engager, ou qui doit le faire valider par quelqu’un d’autre.')}</li>
        </UL>
        <P>
          {t('Pour un lavage standard au tarif de votre grille, n’en faites pas : un devis par lavage de 45 € vous prendrait plus de temps que le lavage. Le bon réflexe est la page de réservation, qui fixe le prix avant que le client ne confirme (voir')}{' '}
          <A href="/blog/tarifs-lavage-auto-domicile">{t('comment fixer vos tarifs')}</A>).
        </P>

        <H2>{t('Ce qu’un bon devis contient')}</H2>
        <P>
          {t('Un devis sert à ce que vous et votre client parliez de la même chose. Chaque ligne du tableau ci-dessous évite un malentendu précis.')}
        </P>
        <Table
          head={[t('Mention'), t('Pourquoi elle compte')]}
          rows={[
            [t('Date d’établissement et numéro du devis'), t('Retrouver le bon document, et prouver à partir de quand le prix court.')],
            [t('Vos coordonnées : nom légal, SIRET, adresse, téléphone'), t('Identifier qui s’engage. Un devis sans SIRET ressemble à une annonce.')],
            [t('Coordonnées du client et lieu de la prestation'), t('Éviter la confusion entre deux adresses ou deux véhicules.')],
            [t('Détail ligne par ligne : prestation, quantité, prix unitaire'), t('C’est ce qui sépare « lavage complet » de ce que vous faites vraiment.')],
            [t('Le total'), t('Un seul chiffre final, celui que le client paiera, déplacement compris.')],
            [t('Durée de validité'), t('Jusqu’à quand votre prix tient. Sans elle, vous restez engagé sans limite.')],
            [t('Ce qui n’est pas inclus'), t('Tapis, coffre, poils d’animaux : dites-le avant, pas devant la voiture.')],
          ]}
        />
        <H2>{t('La durée de validité : combien mettre')}</H2>
        <P>
          {t('Elle doit exister : un devis sans date de fin vous engage sur votre prix aussi longtemps que le client voudra bien le garder dans sa messagerie. Les repères ci-dessous sont indicatifs, pas des règles :')}
        </P>
        <UL>
          <li><strong>{t('Un mois')}</strong>{' '}{t('pour une prestation ponctuelle. C’est le choix par défaut de WashBoard ({jours} jours).', { jours: VALIDITE_DEVIS_JOURS })}</li>
          <li><strong>{t('Une à deux semaines')}</strong>{' '}{t('si votre planning est plein ou si le prix dépend d’un produit dont le coût bouge.')}</li>
          <li><strong>{t('Deux à trois mois')}</strong>{' '}{t('pour un contrat saisonnier ou une flotte qui doit faire valider le budget en interne.')}</li>
        </UL>

        <H2>{t('Un modèle de devis à recopier')}</H2>
        <P>
          {t('Voici la forme d’un devis complet pour un lavage à domicile. Les prix sont un exemple chiffré dans la fourchette indicative des')}{' '}
          <A href="/blog/tarifs-lavage-auto-domicile">{t('tarifs du lavage auto à domicile')}</A> {t(': ajustez-les aux vôtres.')}
        </P>
        <Table
          head={[t('Rubrique'), t('Exemple')]}
          rows={[
            [t('En-tête'), t('Devis n° D-00012, établi le 18/10/2026, valable jusqu’au 17/11/2026')],
            [t('Prestataire'), t('Dupont Lavage EI, SIRET 123 456 789 00012, 12 rue des Lilas, 95000 Cergy, 06 00 00 00 00')],
            [t('Client'), t('Mme Martin, 4 allée du Parc, 95800 Cergy, Peugeot 308 grise')],
            [t('Lieu et date'), t('Au domicile du client, date à convenir')],
            [t('Lignes'), t('Lavage complet intérieur et extérieur : 1 × 90,00 €. Traitement des poils d’animaux : 1 × 25,00 €. Déplacement : 1 × 10,00 €')],
            [t('Total'), t('Total : 125,00 €')],
            [t('Conditions'), t('Paiement le jour de la prestation. Annulation sans frais jusqu’à 24 h avant.')],
            [t('Accord'), t('Date, signature et mention « Bon pour accord » du client')],
          ]}
        />
        <P>
          {t('Les noms, le SIRET et les prix de cet exemple sont fictifs. Une ligne de plus qu’il faut savoir écrire : tout ce que le devis ne couvre pas. « Toute durée supplémentaire fait l’objet d’un accord préalable » vaut mieux qu’une dispute devant la voiture.')}
        </P>

        <H2>{t('Faire accepter un devis, et le suivre')}</H2>
        <P>
          {t('Un devis envoyé et oublié est un devis perdu. Trois habitudes changent le taux d’acceptation sans changer le prix : l’envoyer dans l’heure plutôt que le lendemain, tant que le client pense encore à sa voiture ; le relancer une fois par un message court quelques jours plus tard ; le relancer une dernière fois à l’approche de sa date de fin. Notez aussi la réponse, même un refus : un client qui dit non au prix aujourd’hui peut dire oui pour un lavage simple le mois prochain.')}
        </P>
        <P>
          {t('Une fois accepté, faites la prestation aux conditions écrites, et facturez ce qui a été convenu. Le devis devient alors la base de votre facture : voir')}{' '}
          <A href="/facturation-laveur-auto">{t('la facturation d’un laveur auto mobile')}</A>.
        </P>

        <H2>{t('Ce qui ne marche pas')}</H2>
        <UL>
          <li>
            <strong>{t('Le devis flou.')}</strong>{' '}{t('« Lavage complet : 90 € » ne dit pas ce qui est inclus. Le jour où le client attendait les tapis et les vitres intérieures, c’est vous qui avez tort aux yeux de tout le monde.')}
          </li>
          <li>
            <strong>{t('Le « à partir de ».')}</strong>{' '}{t('Un prix plancher sans plafond n’est pas un devis : le client retient le plancher, et la différence se règle à la fin, dans la gêne.')}
          </li>
          <li>
            <strong>{t('Pas de date de fin.')}</strong>{' '}{t('Le prix d’un produit ou d’un trajet change en six mois, votre devis reste.')}
          </li>
          <li>
            <strong>{t('Un devis pour tout.')}</strong>{' '}{t('Écrire un devis pour un lavage standard fait perdre du temps des deux côtés. Réservez-le à ce qui sort de la grille.')}
          </li>
          <li>
            <strong>{t('Changer le prix après accord.')}</strong>{' '}{t('Même si le véhicule était plus sale que prévu. Si ce risque est réel, écrivez-le dans le devis (surcoût au-delà de telle durée) ou passez voir le véhicule avant de chiffrer.')}
          </li>
          <li>
            <strong>{t('Ne rien garder.')}</strong>{' '}{t('Un devis accepté par message vocal ne prouve rien. Demandez une confirmation écrite, même d’un mot.')}
          </li>
        </UL>

        <H2>{t('Les écrire sans y passer la soirée')}</H2>
        <P>
          {t('Le vrai problème n’est pas la forme du devis, c’est le moment où vous l’écrivez : sur le parking du client, entre deux voitures, sur votre téléphone. Un modèle Word recopié le soir donne un devis tardif, et un devis tardif est un client qui a rappelé le concurrent.')}
        </P>

        <Faq items={faq} />

        <Cta
          title={t('Un devis écrit depuis votre téléphone, sur place')}
          secondary={lienPageMetierTraduit(t, article.theme)}
        >
          {t('Avec WashBoard, en formule')} {requiredPlanLabel('facturation')} ({tarifOffre(offreDevis).replace('/mois', t('/mois'))}{t('), vous écrivez le devis depuis la version mobile, sans rendez-vous derrière : client, lignes, total et date de validité (')}{VALIDITE_DEVIS_JOURS} {t('jours proposés). Il part par email avec son PDF ou par WhatsApp, vous notez la réponse du client, et un devis accepté se transforme en facture d’un tap. Vos informations de facturation (nom légal, SIRET, adresse) doivent être renseignées pour émettre un document. Il n’y a pas de signature électronique : la réponse du client est notée par vos soins.')}
        </Cta>

        <AlsoRead
          items={[
            { href: '/facturation-laveur-auto', label: t('Facturation pour laveur auto mobile : SIRET, TVA, numérotation') },
            { href: '/blog/lavage-flotte-vehicules-entreprise', label: t('Laver pour les entreprises : flottes, concessions, loueurs, auto-écoles') },
            { href: '/blog/tarifs-lavage-auto-domicile', label: t('Quels tarifs pratiquer en lavage auto à domicile') },
          ]}
        />
      </article>
    </>
  )
}

import type { Metadata } from 'next'
import { getArticle, SITE_URL } from '@/lib/blog'
import { lienPageMetierTraduit } from '@/lib/metiers'
import { requiredPlanLabel } from '@/lib/plan'
import { H2, P, UL, A, Callout, Table, Summary, Faq, ArticleHeader, Cta, AlsoRead, ArticleJsonLd, type FaqItem } from '@/components/blog/Prose'
import { getTArticle as getT } from '@/lib/i18n/serveur'

const article = getArticle('nettoyage-canape-domicile-lancer-activite')!
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
    section: 'Canapés & textiles',
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
      question: t('Combien coûte le nettoyage d’un canapé à domicile ?'),
      answer:
        t('Le nettoyage d’un canapé en tissu par un professionnel à domicile se facture généralement 60 à 90 € pour un deux places, 80 à 130 € pour un trois places, 120 à 200 € pour un canapé d’angle. Un matelas se situe entre 50 et 100 € selon la taille, un fauteuil autour de 40 à 60 €. Les taches incrustées, les poils d’animaux et les odeurs (urine, tabac) se facturent en supplément.'),
    },
    {
      question: t('Quel matériel pour nettoyer des canapés professionnellement ?'),
      answer:
        t('Une machine à injection-extraction (400 à 1 500 € pour un modèle professionnel compact), un aspirateur puissant avec brosse textile, un pulvérisateur pour le pré-traitement, des produits adaptés à chaque fibre (détachant, shampoing textile, neutralisant d’odeurs), des brosses douces et des microfibres. Un ventilateur ou un sécheur accélère le séchage chez le client.'),
    },
    {
      question: t('Combien de temps pour nettoyer un canapé ?'),
      answer:
        t('Comptez 1 h à 1 h 30 pour un canapé trois places : aspiration, pré-traitement des taches, injection-extraction, brossage des fibres. Le séchage complet prend ensuite 4 à 8 heures selon la fibre, la ventilation et la saison ; le client peut s’asseoir dessus le soir même dans la plupart des cas.'),
    },
    {
      question: t('Peut-on nettoyer tous les canapés à l’injection-extraction ?'),
      answer:
        t('Non. Les tissus marqués « S » (nettoyage à sec uniquement) ou « X » (aspiration seule) sur l’étiquette, les velours de soie, certains linges et laines, et les cuirs relèvent d’autres méthodes. Avant toute intervention, vérifiez l’étiquette d’entretien et testez le produit sur une zone cachée : un auréolage ou une décoloration ne se rattrape pas.'),
    },
    {
      question: t('Le nettoyage de canapés est-il rentable ?'),
      answer:
        t('C’est l’un des métiers du nettoyage à domicile à la meilleure marge : peu de consommables (2 à 5 € par prestation), un matériel amorti en quelques dizaines de prestations, et un panier moyen de 80 à 150 € pour une heure et demie sur place. La contrainte est l’absence de récurrence : un canapé se nettoie une à deux fois par an, il faut donc alimenter en permanence la demande.'),
    },
  ]

  return (
    <>
      <ArticleJsonLd article={article} siteUrl={SITE_URL} faq={faq} />
      <article>
        <ArticleHeader
          article={article}
          intro={t('C\'est le métier du nettoyage à domicile qui se vend le mieux en photo : un canapé beige qui redevient beige, une auréole qui disparaît. Une heure et demie sur place, un panier de 80 à 150 €, presque pas de consommables. Le piège, c\'est que ça ne revient pas tout seul.')}
        />

        <Summary
          items={[
            t('Prestations : canapés, fauteuils, matelas, tapis, moquettes, sièges de voiture — la même machine sert à tout.'),
            t('Matériel de départ : 800 à 2 000 € (injection-extraction, aspirateur, produits), amorti en 15 à 30 prestations.'),
            t('Tarifs courants : 80 à 130 € pour un canapé trois places, 50 à 100 € pour un matelas, suppléments pour taches, poils et odeurs.'),
            t('Le résultat se vend sur les photos avant/après : fiche Google et réseaux sociaux sont vos premiers canaux.'),
            t('Pas de récurrence naturelle : le revenu tient sur la demande entrante et sur la combinaison avec un autre métier (lavage auto, ménage).'),
          ]}
        />

        <P>
          {t('Le nettoyage de textiles d’ameublement a longtemps été réservé aux sociétés de nettoyage industriel. Les machines compactes à injection-extraction ont changé la donne : un indépendant avec un équipement de 1 500 € obtient chez un particulier le même résultat qu’une entreprise avec un camion. Et la demande est là : un canapé coûte 800 à 3 000 €, un client préfère payer 100 € pour le rénover que le remplacer.')}
        </P>

        <H2>{t('1. Ce que vous vendez, et à quel prix')}</H2>
        <Table
          head={[t('Prestation'), t('Tarif courant'), t('Temps sur place')]}
          rows={[
            [t('Fauteuil'), '40 – 60 €', t('30 – 45 min')],
            [t('Canapé 2 places'), '60 – 90 €', t('45 min – 1 h')],
            [t('Canapé 3 places'), '80 – 130 €', '1 h – 1 h 30'],
            [t('Canapé d’angle'), '120 – 200 €', '1 h 30 – 2 h 30'],
            [t('Matelas (1 ou 2 places)'), '50 – 100 €', t('30 – 60 min')],
            [t('Tapis (au m²)'), '8 – 20 € / m²', t('Variable')],
            [t('Moquette (au m²)'), '4 – 10 € / m²', t('Variable')],
            [t('Sièges de voiture (par véhicule)'), '60 – 120 €', '1 h – 1 h 30'],
            [t('Supplément taches, poils, odeurs'), '+ 15 à 40 €', t('+ 15 – 30 min')],
          ]}
        />
        <P>
          {t('Le tarif se construit comme pour')}{' '}
          <A href="/blog/tarifs-lavage-auto-domicile">{t('n’importe quel métier à domicile')}</A> {t(': le temps réel, trajet compris, plus les charges, plus la marge. Deux spécificités ici. Le supplément « état » doit être annoncé')} <strong>{t('avant')}</strong>{t(', sur photo si possible : un canapé avec trois ans de poils de chat n’est pas un canapé. Et le déplacement pèse lourd sur un panier de 80 € : un forfait de deux pièces (canapé + matelas, canapé + fauteuils) rentabilise la venue et se vend très bien.')}
        </P>

        <H2>{t('2. Le matériel et les produits')}</H2>
        <Table
          head={[t('Poste'), t('Budget indicatif')]}
          rows={[
            [t('Injection-extraction professionnelle compacte'), '400 – 1 500 €'],
            [t('Aspirateur puissant + brosse textile'), '150 – 400 €'],
            [t('Pulvérisateur à pression (pré-traitement)'), '20 – 60 €'],
            [t('Produits : shampoing textile, détachants, neutralisant d’odeurs'), t('100 – 250 € de départ')],
            [t('Brosses, microfibres, bâche de protection du sol'), '50 – 100 €'],
            [t('Ventilateur ou sécheur portable'), '50 – 150 €'],
            [t('Lampe UV (urine, taches invisibles)'), '20 – 40 €'],
          ]}
        />
        <P>
          {t('La machine fait la moitié du travail : puissance d’aspiration (le séchage en dépend), pression d’injection, capacité des réservoirs. Un modèle d’entrée de gamme grand public tient trois mois d’usage professionnel. Achetez d’occasion un modèle pro plutôt que neuf un modèle amateur.')}
        </P>
        <Callout>
          <p>
            <strong>{t('Le test sur zone cachée n’est pas optionnel.')}</strong>{' '}{t('Chaque tissu réagit différemment : un velours qui s’auréole, une microfibre qui perd sa couleur, une laine qui feutre. Le test prend deux minutes derrière un coussin ; la décoloration d’un canapé à 2 000 € prend une seconde et vous coûte sa valeur.')}
          </p>
        </Callout>

        <H2>{t('3. Le déroulé d’une prestation')}</H2>
        <UL>
          <li><strong>{t('Diagnostic')}</strong> {t(': étiquette d’entretien, nature des taches, test sur zone cachée. Vous annoncez ce qui partira et ce qui ne partira peut-être pas.')}</li>
          <li><strong>{t('Aspiration complète')}</strong>{t(', coussins retirés, plis et coutures compris. C’est l’étape qu’on bâcle et qui fait la différence : la poussière humidifiée devient de la boue.')}</li>
          <li><strong>{t('Pré-traitement')}</strong> {t('des taches et des zones de contact (accoudoirs, appuie-tête), temps de pose.')}</li>
          <li><strong>{t('Injection-extraction')}</strong>{t(', passes croisées, sans saturer le tissu.')}</li>
          <li><strong>{t('Brossage des fibres')}</strong> {t('dans le sens du poil, ventilation, consignes de séchage au client.')}</li>
          <li><strong>{t('Photos après')}</strong>{t(', sous le même angle et la même lumière que les photos avant.')}</li>
        </UL>
        <P>
          {t('Ce dernier point n’est pas du détail. Dans ce métier, les photos avant/après sont votre publicité entière, et elles se prennent pendant la prestation ou jamais.')}
        </P>

        <H2>{t('4. Trouver les clients : un métier de photos')}</H2>
        <P>
          {t('Personne ne pense à faire nettoyer son canapé jusqu’à ce qu’il voie ce que ça donne. Vos canaux, dans l’ordre :')}
        </P>
        <UL>
          <li>
            <strong>{t('La fiche Google')}</strong>{' '}{t('avec vingt photos avant/après, catégorie « Service de nettoyage de tapis et moquettes » ou « Nettoyage de meubles rembourrés ». Les recherches « nettoyage canapé + ville » sont fréquentes et très qualifiées. Les réglages sont dans')}{' '}
            <A href="/blog/fiche-google-laveur-auto-mobile">{t('notre guide de la fiche Google')}</A>.
          </li>
          <li>
            <strong>{t('Instagram et TikTok')}</strong>{' '}{t(': c’est l’un des rares métiers du nettoyage où les réseaux sociaux amènent vraiment des clients. Une vidéo de 15 secondes d’une auréole qui disparaît sous la buse tourne toute seule.')}
          </li>
          <li>
            <strong>{t('Les professionnels')}</strong>{' '}{t(': hôtels, gîtes et locations saisonnières (matelas et canapés entre deux saisons), restaurants (banquettes), crèches, cabinets médicaux, concessions (sièges des véhicules d’occasion). Ce sont eux qui apportent la récurrence que les particuliers n’ont pas.')}
          </li>
          <li>
            <strong>{t('Le client d’un autre métier.')}</strong>{' '}{t('Si vous faites aussi du')}{' '}
            <A href="/blog/devenir-laveur-auto-mobile">{t('lavage auto')}</A>{' '}{t('ou du ménage, chaque client existant a un canapé. Proposer les sièges de la voiture en même temps que l’intérieur, ou le canapé en fin de ménage, coûte une phrase.')}
          </li>
        </UL>

        <H2>{t('5. Le problème de la récurrence, et comment le régler')}</H2>
        <P>
          {t('Un canapé se nettoie une à deux fois par an. Avec cent clients particuliers satisfaits, vous n’avez que dix à quinze prestations par mois assurées. Trois manières de stabiliser l’activité :')}
        </P>
        <UL>
          <li>
            <strong>{t('Relancer à date.')}</strong>{' '}{t('Six mois après la prestation, un message « votre canapé a été nettoyé en mars, c’est le moment » déclenche une prestation sur quatre ou cinq. Ça ne se fait pas de mémoire, ça s’automatise.')}
          </li>
          <li>
            <strong>{t('Les contrats pros')}</strong>{' '}{t(': un hôtel de vingt chambres, ce sont vingt matelas deux fois par an, planifiés à l’avance.')}
          </li>
          <li>
            <strong>{t('Combiner avec un métier récurrent.')}</strong>{' '}{t('Beaucoup d’indépendants font du textile en complément du lavage auto ou du ménage : la même clientèle, le même véhicule, un panier moyen qui monte.')}
          </li>
        </UL>

        <Faq items={faq} />

        <Cta
          title={t('Relancez chaque client au bon moment')}
          secondary={lienPageMetierTraduit(t, article.theme)}
        >
          {t('WashBoard garde l’historique de chaque client — quelle prestation, quelle date, quel montant — vous signale ceux qui ne sont pas revenus, et peut leur envoyer une relance automatiquement (à partir de la formule')} {requiredPlanLabel('followup')}{t('). Vos clients réservent seuls sur votre lien, peuvent verser un acompte pour sécuriser le rendez-vous, et la demande d’avis Google part après chaque prestation.')}
        </Cta>

        <AlsoRead
          items={[
            { href: '/blog/tarifs-menage-domicile-auto-entrepreneur', label: t('Ménage à domicile en indépendant : tarifs, planning et clients réguliers') },
            { href: '/blog/devenir-laveur-auto-mobile', label: t('Devenir laveur auto mobile : par où commencer') },
            { href: '/blog/fiche-google-laveur-auto-mobile', label: t('Fiche Google pour laveur auto mobile : la configurer pour recevoir des appels') },
          ]}
        />
      </article>
    </>
  )
}

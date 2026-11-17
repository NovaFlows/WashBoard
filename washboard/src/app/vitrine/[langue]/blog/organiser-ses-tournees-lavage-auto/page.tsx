import type { Metadata } from 'next'
import { getArticle, SITE_URL } from '@/lib/blog'
import { lienPageMetierTraduit } from '@/lib/metiers'
import { requiredPlanLabel } from '@/lib/plan'
import { H2, P, UL, A, Callout, Table, Summary, Faq, ArticleHeader, Cta, AlsoRead, ArticleJsonLd, type FaqItem } from '@/components/blog/Prose'
import { getTArticle as getT } from '@/lib/i18n/serveur'
import { imagePartage } from '@/lib/imagePartage'
import { alt as altImage } from '@/app/blog/organiser-ses-tournees-lavage-auto/opengraph-image'

const article = getArticle('organiser-ses-tournees-lavage-auto')!
const url = `${SITE_URL}/blog/${article.slug}`

export const metadata: Metadata = {
  title: `${article.title} | WashBoard`,
  description: article.description,
  alternates: { canonical: url },
  openGraph: {
    images: imagePartage('/blog/organiser-ses-tournees-lavage-auto', altImage),
    type: 'article',
    url,
    title: article.title,
    description: article.description,
    publishedTime: article.publishedAt,
    modifiedTime: article.updatedAt,
    authors: ['WashBoard'],
    section: 'Organisation',
  },
  twitter: { images: imagePartage('/blog/organiser-ses-tournees-lavage-auto', altImage), card: 'summary_large_image', title: article.title, description: article.description },
}


export default async function Page() {
  const t = await getT()
  const faq: FaqItem[] = [
    {
      question: t('Combien de voitures un laveur auto mobile peut-il laver par jour ?'),
      answer:
        t('Entre trois et six selon les prestations et surtout selon la route. Un laveur qui enchaîne des lavages extérieurs dans un même quartier peut en faire six ; un laveur qui traverse la ville entre chaque rendez-vous plafonne à trois ou quatre, même en travaillant plus vite.'),
    },
    {
      question: t('Comment organiser ses tournées de lavage auto à domicile ?'),
      answer:
        t('Réservez des journées ou des demi-journées par secteur (le lundi l’ouest, le mardi le centre…) et ne proposez à chaque client que les créneaux où vous êtes déjà dans sa zone. Prévoyez une marge de 15 à 45 minutes entre deux prestations selon leur durée, confirmez la veille, et gardez une liste d’attente par secteur pour combler les annulations.'),
    },
    {
      question: t('Combien de temps prévoir pour un lavage auto ?'),
      answer:
        t('40 à 60 minutes pour un extérieur, 1 h 30 à 2 h 30 pour un lavage complet, 3 heures et plus pour un intérieur très encrassé. Ajoutez 30 à 50 % pour un SUV, un monospace ou un utilitaire, et une marge de 15 à 45 minutes pour absorber les imprévus.'),
    },
    {
      question: t('Comment limiter les annulations de dernière minute ?'),
      answer:
        t('Envoyez un message de rappel la veille : il réduit nettement les oublis et vous laisse le temps de replacer le créneau. Tenez une liste d’attente par secteur, gardez un client professionnel (garage, concession) dans chaque zone, qui accepte souvent de vous prendre au pied levé, et demandez un acompte sur les prestations longues : un client qui a payé d’avance oublie beaucoup moins son rendez-vous.'),
    },
  ]

  return (
    <>
      <ArticleJsonLd article={article} siteUrl={SITE_URL} faq={faq} />
      <article>
        <ArticleHeader
          article={article}
          intro={t('À prestations égales, deux laveurs peuvent avoir des revenus qui varient du simple au double. La différence ne vient presque jamais de la vitesse d\'exécution : elle vient de la route.')}
        />

        <Summary
          items={[
            t('Un laveur mal organisé passe deux heures par jour au volant : une à deux prestations perdues, sans travailler une minute de moins.'),
            t('Réservez des journées ou demi-journées par secteur, et proposez au client uniquement les créneaux où vous êtes déjà dans sa zone.'),
            t('Prévoyez des durées réalistes avec 15 à 45 minutes de marge : une journée sans marge déraille au premier imprévu.'),
            t('Confirmez la veille, tenez une liste d’attente par secteur, gardez un client pro par zone pour absorber les annulations.'),
            t('C’est le seul levier qui augmente le revenu sans toucher ni aux prix, ni au temps de travail.'),
          ]}
        />

        <P>
          {t('Sur une journée de huit heures, un laveur mal organisé passe facilement deux heures au volant. Deux heures, c’est une à deux prestations perdues — soit, sur un mois, de quoi changer complètement le résultat sans avoir travaillé une minute de plus.')}
        </P>

        <H2>{t('Le coût réel d’un trajet')}</H2>
        <P>
          {t('Prenons un exemple simple. Bordeaux Nord à 9 h, Bordeaux Sud à 10 h 30 : environ quarante-cinq minutes de route entre les deux, hors circulation. Si vous facturez 60 € une prestation d’une heure trente, ces quarante-cinq minutes vous coûtent 30 € de manque à gagner. Deux fois par semaine, cela représente près de 260 € par mois — l’équivalent d’une hausse de tarif que vous n’avez pas eu à négocier (voir')}{' '}
          <A href="/blog/tarifs-lavage-auto-domicile">{t('comment fixer ses tarifs')}</A>).
        </P>
        <P>
          {t('Et ce calcul ne compte que le temps. S’y ajoutent le carburant, l’usure du véhicule, et surtout la fatigue : conduire entre deux prestations physiques use plus vite qu’enchaîner deux voitures au même endroit.')}
        </P>

        <H2>{t('Grouper par secteur, pas par ordre d’arrivée')}</H2>
        <P>
          {t('Le réflexe naturel est de placer chaque nouveau client au premier créneau libre. C’est exactement ce qui fabrique des journées en zigzag.')}
        </P>
        <P>
          {t('L’approche inverse consiste à réserver des')} <strong>{t('journées ou des demi-journées par secteur')}</strong>{t('. Le lundi, l’ouest. Le mardi, le centre. Quand un client de l’ouest appelle, vous lui proposez le lundi. Vous ne lui donnez pas le choix complet de la semaine, vous lui donnez le choix parmi vos créneaux dans son secteur.')}
        </P>
        <Callout>
          <p>
            <strong>{t('Cette contrainte se vend très bien.')}</strong>{' '}{t('« Je suis dans votre quartier mardi matin, je peux passer à 9 h ou 11 h » sonne mieux que « quand voulez-vous ? ». Ça donne l’image d’une activité organisée et demandée, et ça évite au client de devoir choisir dans le vide.')}
          </p>
        </Callout>
        <P>
          {t('Vous pouvez même encourager ces créneaux avec une petite remise. Dix pour cent sur un créneau qui vous économise quarante minutes de route est une excellente affaire pour vous deux. C’est exactement ce que')}{' '}
          <A href="/optimisation-tournee-lavage-auto">{t('les créneaux groupés de WashBoard')}</A>{' '}
          {t('automatisent (formule')} {requiredPlanLabel('creneaux_intelligents')}{t(') : le logiciel compare le trajet réel à vos rendez-vous du jour et met en avant les horaires proches, avec la remise que vous avez réglée.')}
        </P>

        <H2>{t('Prévoir des durées réalistes')}</H2>
        <P>
          {t('La deuxième cause de journées qui déraillent, c’est le sous-dimensionnement. Un intérieur annoncé à une heure qui en demande deux décale tout ce qui suit, et vous finissez par bâcler la dernière voiture ou par arriver chez un client avec une heure de retard.')}
        </P>

        <Table
          head={[t('Prestation'), t('Durée à prévoir'), t('Marge conseillée')]}
          rows={[
            [t('Lavage extérieur'), t('40 – 60 min'), t('+ 15 min')],
            [t('Lavage complet'), '1 h 30 – 2 h 30', t('+ 30 min')],
            [t('Intérieur très encrassé'), t('3 h et plus'), t('+ 45 min')],
            [t('SUV, monospace, utilitaire'), '+ 30 à 50 %', '—'],
          ]}
        />

        <P>
          {t('La marge n’est pas du temps perdu : elle absorbe l’imprévu, le client qui veut discuter, la place de stationnement introuvable. Une journée sans marge est une journée où le moindre grain de sable se propage jusqu’au soir.')}
        </P>

        <H2>{t('Absorber les annulations sans perdre la journée')}</H2>
        <P>
          {t('Une annulation la veille laisse un trou de deux heures au milieu d’une journée bien remplie. Quatre réflexes limitent la casse :')}
        </P>
        <UL>
          <li>
            <strong>{t('Confirmer la veille.')}</strong>{' '}{t('Un message de rappel réduit nettement les oublis et les absences, et vous laisse le temps de replacer le créneau.')}
          </li>
          <li>
            <strong>{t('Tenir une liste d’attente par secteur.')}</strong>{' '}{t('Les clients qui voulaient un créneau déjà pris sont vos premiers appels quand un trou se libère.')}
          </li>
          <li>
            <strong>{t('Garder un client pro dans le secteur.')}</strong>{' '}{t('Un garage ou une concession avec plusieurs véhicules en attente accepte souvent de vous prendre au pied levé.')}
          </li>
          <li>
            <strong>{t('Demander un acompte sur les prestations longues.')}</strong>{' '}{t('Un client qui a payé d’avance pense à son rendez-vous, et un créneau qui reste impayé au-delà du délai se libère plutôt que de rester bloqué. Le calcul, les montants et les pièges sont détaillés dans')}{' '}
            <A href="/blog/acompte-reservation-laveur-auto-mobile">{t('notre guide sur l’acompte à la réservation')}</A>.
          </li>
        </UL>

        <H2>{t('Anticiper la saison')}</H2>
        <P>
          {t('L’activité n’est pas régulière sur l’année. Le printemps et l’automne concentrent la demande des particuliers ; l’hiver est plus creux côté particuliers mais reste stable côté professionnels, dont les véhicules se salissent d’autant plus.')}
        </P>
        <P>
          {t('C’est pendant les périodes chargées qu’il faut préparer les creuses : c’est là que vous rencontrez le plus de monde, donc le meilleur moment pour récolter des avis et')}{' '}
          <A href="/blog/trouver-des-clients-laveur-auto-mobile">{t('démarcher des clients professionnels')}</A>{t('. Ceux-ci lisseront votre activité quand les particuliers se feront rares.')}
        </P>

        <H2>{t('Ce qui se joue vraiment')}</H2>
        <P>
          {t('Améliorer son organisation ne demande ni investissement ni nouveau client. C’est le seul levier qui augmente le revenu sans augmenter ni les prix, ni le temps de travail. Sur la plupart des activités de lavage à domicile, c’est aussi le plus gros gisement disponible — et le plus ignoré, parce qu’il ne se voit pas sur une facture.')}
        </P>

        <Faq items={faq} />

        <Cta
          title={t('Des tournées groupées, sans y penser')}
          secondary={lienPageMetierTraduit(t, article.theme)}
        >
          {t('WashBoard calcule le temps de trajet réel entre deux prestations et ne propose jamais au client un horaire que la route rend impossible. Avec la formule')}{' '}
          {requiredPlanLabel('creneaux_intelligents')}{t(', il met aussi en avant les créneaux proches d’un rendez-vous déjà prévu, avec la remise que vous avez réglée. Vous roulez moins, vous lavez plus.')}
        </Cta>

        <AlsoRead
          items={[
            { href: '/blog/combien-gagne-un-laveur-auto-mobile', label: t('Combien gagne un laveur auto mobile ? Revenus réels et simulation') },
            { href: '/blog/trouver-des-clients-laveur-auto-mobile', label: t('Comment trouver des clients quand on est laveur auto mobile') },
            { href: '/blog/acompte-reservation-laveur-auto-mobile', label: t('Acompte à la réservation pour un laveur auto mobile : sans perdre de clients') },
            { href: '/blog/tarifs-lavage-auto-domicile', label: t('Quels tarifs pratiquer en lavage auto à domicile') },
            { href: '/blog/devenir-laveur-auto-mobile', label: t('Devenir laveur auto mobile : par où commencer') },
          ]}
        />
      </article>
    </>
  )
}

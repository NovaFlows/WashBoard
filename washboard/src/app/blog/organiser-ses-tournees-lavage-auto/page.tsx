import type { Metadata } from 'next'
import { getArticle, SITE_URL } from '@/lib/blog'
import { H2, P, UL, Callout, Table, ArticleHeader, Cta, AlsoRead, ArticleJsonLd } from '@/components/blog/Prose'

const article = getArticle('organiser-ses-tournees-lavage-auto')!
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
  },
  twitter: { card: 'summary_large_image', title: article.title, description: article.description },
}

export default function Page() {
  return (
    <>
      <ArticleJsonLd article={article} siteUrl={SITE_URL} />
      <article>
        <ArticleHeader
          article={article}
          intro="À prestations égales, deux laveurs peuvent avoir des revenus qui varient du simple au double. La différence ne vient presque jamais de la vitesse d'exécution : elle vient de la route."
        />

        <P>
          Sur une journée de huit heures, un laveur mal organisé passe facilement deux heures au
          volant. Deux heures, c&apos;est une à deux prestations perdues — soit, sur un mois, de
          quoi changer complètement le résultat sans avoir travaillé une minute de plus.
        </P>

        <H2>Le coût réel d&apos;un trajet</H2>
        <P>
          Prenons un exemple simple. Bordeaux Nord à 9 h, Bordeaux Sud à 10 h 30 : environ
          quarante-cinq minutes de route entre les deux, hors circulation. Si vous facturez 60 € une
          prestation d&apos;une heure trente, ces quarante-cinq minutes vous coûtent 30 € de manque
          à gagner. Deux fois par semaine, cela représente près de 260 € par mois.
        </P>
        <P>
          Et ce calcul ne compte que le temps. S&apos;y ajoutent le carburant, l&apos;usure du
          véhicule, et surtout la fatigue : conduire entre deux prestations physiques use plus
          vite qu&apos;enchaîner deux voitures au même endroit.
        </P>

        <H2>Grouper par secteur, pas par ordre d&apos;arrivée</H2>
        <P>
          Le réflexe naturel est de placer chaque nouveau client au premier créneau libre. C&apos;est
          exactement ce qui fabrique des journées en zigzag.
        </P>
        <P>
          L&apos;approche inverse consiste à réserver des <strong>journées ou des demi-journées par
          secteur</strong>. Le lundi, l&apos;ouest. Le mardi, le centre. Quand un client de
          l&apos;ouest appelle, vous lui proposez le lundi. Vous ne lui donnez pas le choix complet
          de la semaine, vous lui donnez le choix parmi vos créneaux dans son secteur.
        </P>
        <Callout>
          <p>
            <strong>Cette contrainte se vend très bien.</strong>{' '}« Je suis dans votre quartier
            mardi matin, je peux passer à 9 h ou 11 h » sonne mieux que « quand voulez-vous ? ».
            Ça donne l&apos;image d&apos;une activité organisée et demandée, et ça évite au client
            de devoir choisir dans le vide.
          </p>
        </Callout>
        <P>
          Vous pouvez même encourager ces créneaux avec une petite remise. Dix pour cent sur un
          créneau qui vous économise quarante minutes de route est une excellente affaire pour vous
          deux.
        </P>

        <H2>Prévoir des durées réalistes</H2>
        <P>
          La deuxième cause de journées qui déraillent, c&apos;est le sous-dimensionnement. Un
          intérieur annoncé à une heure qui en demande deux décale tout ce qui suit, et vous
          finissez par bâcler la dernière voiture ou par arriver chez un client avec une heure de
          retard.
        </P>

        <Table
          head={['Prestation', 'Durée à prévoir', 'Marge conseillée']}
          rows={[
            ['Lavage extérieur', '40 – 60 min', '+ 15 min'],
            ['Lavage complet', '1 h 30 – 2 h 30', '+ 30 min'],
            ['Intérieur très encrassé', '3 h et plus', '+ 45 min'],
            ['SUV, monospace, utilitaire', '+ 30 à 50 %', '—'],
          ]}
        />

        <P>
          La marge n&apos;est pas du temps perdu : elle absorbe l&apos;imprévu, le client qui veut
          discuter, la place de stationnement introuvable. Une journée sans marge est une journée où
          le moindre grain de sable se propage jusqu&apos;au soir.
        </P>

        <H2>Absorber les annulations sans perdre la journée</H2>
        <P>
          Une annulation la veille laisse un trou de deux heures au milieu d&apos;une journée bien
          remplie. Trois réflexes limitent la casse :
        </P>
        <UL>
          <li>
            <strong>Confirmer la veille.</strong>{' '}Un message de rappel réduit nettement les
            oublis et les absences, et vous laisse le temps de replacer le créneau.
          </li>
          <li>
            <strong>Tenir une liste d&apos;attente par secteur.</strong>{' '}Les clients qui voulaient
            un créneau déjà pris sont vos premiers appels quand un trou se libère.
          </li>
          <li>
            <strong>Garder un client pro dans le secteur.</strong>{' '}Un garage ou une concession
            avec plusieurs véhicules en attente accepte souvent de vous prendre au pied levé.
          </li>
        </UL>

        <H2>Anticiper la saison</H2>
        <P>
          L&apos;activité n&apos;est pas régulière sur l&apos;année. Le printemps et l&apos;automne
          concentrent la demande des particuliers ; l&apos;hiver est plus creux côté particuliers
          mais reste stable côté professionnels, dont les véhicules se salissent d&apos;autant plus.
        </P>
        <P>
          C&apos;est pendant les périodes chargées qu&apos;il faut préparer les creuses : c&apos;est
          là que vous rencontrez le plus de monde, donc le meilleur moment pour récolter des avis et
          démarcher des clients professionnels. Ceux-ci lisseront votre activité quand les
          particuliers se feront rares.
        </P>

        <H2>Ce qui se joue vraiment</H2>
        <P>
          Améliorer son organisation ne demande ni investissement ni nouveau client. C&apos;est le
          seul levier qui augmente le revenu sans augmenter ni les prix, ni le temps de travail.
          Sur la plupart des activités de lavage à domicile, c&apos;est aussi le plus gros gisement
          disponible — et le plus ignoré, parce qu&apos;il ne se voit pas sur une facture.
        </P>

        <Cta title="Des tournées groupées, sans y penser">
          WashBoard regroupe automatiquement les rendez-vous par quartier, calcule les temps de
          trajet entre deux prestations et ne propose au client que les créneaux réellement
          tenables. Vous roulez moins, vous lavez plus.
        </Cta>

        <AlsoRead
          items={[
            { href: '/blog/trouver-des-clients-laveur-auto-mobile', label: 'Comment trouver des clients quand on est laveur auto mobile' },
            { href: '/blog/tarifs-lavage-auto-domicile', label: 'Quels tarifs pratiquer en lavage auto à domicile' },
            { href: '/blog/devenir-laveur-auto-mobile', label: 'Devenir laveur auto mobile : par où commencer' },
          ]}
        />
      </article>
    </>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { getArticle, SITE_URL } from '@/lib/blog'
import { H2, P, UL, Callout, ArticleHeader, Cta, AlsoRead, ArticleJsonLd } from '@/components/blog/Prose'

const article = getArticle('trouver-des-clients-laveur-auto-mobile')!
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
  twitter: {
    card: 'summary_large_image',
    title: article.title,
    description: article.description,
  },
}

export default function Page() {
  return (
    <>
      <ArticleJsonLd article={article} siteUrl={SITE_URL} />
      <article>
        <ArticleHeader
          article={article}
          intro="Le nerf de la guerre en lavage auto à domicile, ce n'est pas le matériel ni la technique. C'est de remplir l'agenda toutes les semaines, pas seulement les bonnes. Voici les canaux qui marchent vraiment, classés par rapport effort/résultat."
        />

        <P>
          La plupart des laveurs auto mobiles démarrent avec le bouche-à-oreille : la famille, les
          collègues, le voisin qui a vu la voiture briller. Ça remplit les premières semaines, puis
          ça s&apos;essouffle. Le problème n&apos;est pas la qualité du travail — c&apos;est que le
          bouche-à-oreille seul ne se déclenche pas assez souvent pour tenir un planning.
        </P>
        <P>
          Bonne nouvelle : le lavage auto à domicile est une activité <strong>locale</strong> et{' '}
          <strong>récurrente</strong>. Ces deux caractéristiques déterminent tout ce qui suit. Local,
          donc la visibilité sur Google prime sur les réseaux sociaux. Récurrente, donc un client
          gagné vaut bien plus qu&apos;une prestation.
        </P>

        <H2>1. La fiche Google, avant tout le reste</H2>
        <P>
          Quand quelqu&apos;un cherche « nettoyage voiture à domicile » suivi du nom de sa ville,
          Google affiche d&apos;abord une carte avec trois établissements. Y figurer vaut plus que
          n&apos;importe quel post sur les réseaux : la personne qui fait cette recherche veut
          réserver maintenant, pas se divertir.
        </P>
        <P>
          Créer une fiche d&apos;établissement Google est gratuit. Trois points font la différence
          entre une fiche qui dort et une fiche qui amène des appels :
        </P>
        <UL>
          <li>
            <strong>Définir une zone de service</strong>{' '}plutôt qu&apos;une adresse. Vous vous
            déplacez : indiquez les communes couvertes, pas votre domicile.
          </li>
          <li>
            <strong>Des photos de vos propres prestations</strong>, pas des images génériques.
            Avant/après sur de vraies voitures, prises au téléphone. C&apos;est ce que les gens
            regardent en premier.
          </li>
          <li>
            <strong>Les horaires réellement tenus.</strong>{' '}Une fiche qui annonce des créneaux où
            vous ne répondez jamais fait plus de mal que de bien.
          </li>
        </UL>

        <H2>2. Les avis clients : le levier le plus sous-exploité</H2>
        <P>
          Entre deux laveurs, celui qui a 27 avis à 4,8 étoiles gagne systématiquement contre celui
          qui en a 3. Et pourtant la majorité des laveurs ne demandent jamais d&apos;avis, parce que
          ça met mal à l&apos;aise sur le moment, en face du client.
        </P>
        <P>
          La solution est de ne pas le demander de vive voix. Un message envoyé quelques heures
          après la prestation, quand le client vient de retrouver sa voiture propre, obtient un taux
          de réponse bien supérieur à une demande faite sur le pas de la porte — et vous évite la
          gêne. Ce message doit contenir le lien direct vers votre fiche : chaque étape
          supplémentaire fait perdre la moitié des gens.
        </P>
        <Callout>
          <p>
            <strong>Le bon moment, c&apos;est le jour même.</strong>{' '}Un avis demandé trois jours
            plus tard obtient beaucoup moins de réponses : l&apos;effet « waouh » est retombé, la
            voiture a repris la route. WashBoard envoie cette demande automatiquement, par email ou
            SMS, avec le délai de votre choix après le rendez-vous.
          </p>
        </Callout>

        <H2>3. Grouper les clients par quartier au lieu de courir partout</H2>
        <P>
          Ce point n&apos;a l&apos;air d&apos;être qu&apos;une question d&apos;organisation, mais il
          agit directement sur votre capacité à prendre des clients. Un laveur qui fait Bordeaux Nord
          à 9h puis Bordeaux Sud à 10h30 perd 45 minutes de route entre deux prestations. Sur une
          journée, ce sont deux lavages en moins — donc deux clients refusés faute de créneau.
        </P>
        <P>
          Concentrer les rendez-vous d&apos;une même journée sur une même zone augmente le nombre de
          prestations sans allonger la journée de travail. C&apos;est le moyen le plus rapide
          d&apos;augmenter son chiffre d&apos;affaires sans avoir besoin d&apos;un seul client
          supplémentaire.
        </P>
        <P>
          En pratique : proposez à un nouveau client les créneaux où vous êtes déjà dans son secteur,
          plutôt que de lui laisser choisir n&apos;importe quelle heure de la semaine. Vous pouvez
          même l&apos;encourager avec une petite remise sur ces créneaux-là.
        </P>

        <H2>4. Supprimer les frictions à la réservation</H2>
        <P>
          C&apos;est le moment où un <strong>outil de gestion pour laveur auto mobile</strong>{' '}
          change vraiment quelque chose. Tant que vous avez trois clients par semaine, un
          carnet suffit. Passé une dizaine de rendez-vous, le temps passé à répondre aux
          messages, à noter les adresses et à recaler les créneaux dépasse largement celui
          qu&apos;il faudrait pour laver une voiture de plus.
        </P>
        <P>
          Beaucoup de clients potentiels se perdent entre l&apos;intention et le rendez-vous. Le
          scénario classique : la personne vous envoie un message, vous répondez deux heures plus
          tard entre deux voitures, elle répond le lendemain, il faut trois allers-retours pour
          fixer un créneau, et une fois sur trois ça ne se conclut pas.
        </P>
        <P>
          Chaque échange perd du monde. Un lien de réservation où le client choisit son créneau,
          renseigne son adresse et son véhicule tout seul, à 22h s&apos;il le souhaite, transforme
          nettement mieux qu&apos;un fil WhatsApp — et vous n&apos;avez plus à répondre pendant que
          vous travaillez.
        </P>
        <Callout>
          <p>
            C&apos;est exactement ce que fait WashBoard : un lien personnalisé à mettre dans votre
            fiche Google, votre bio Instagram et vos messages. Le client réserve seul, sans créer de
            compte, et vous recevez la demande.{' '}
            <Link href="/signup" className="font-semibold text-[#1651E8] dark:text-[#6A9FFF] hover:underline">
              Essai gratuit d&apos;un mois
            </Link>
            , sans carte bancaire.
          </p>
        </Callout>

        <H2>5. Les clients professionnels : moins nombreux, bien plus rentables</H2>
        <P>
          Un particulier fait laver sa voiture deux à quatre fois par an. Un garage, une concession,
          une auto-école ou une société avec des véhicules de fonction, c&apos;est du récurrent,
          parfois hebdomadaire, avec plusieurs véhicules sur place — donc zéro trajet entre deux
          prestations.
        </P>
        <P>Les cibles les plus accessibles quand on démarre :</P>
        <UL>
          <li><strong>Garages et carrossiers</strong> : ils rendent les véhicules propres à leurs clients et sous-traitent souvent le nettoyage.</li>
          <li><strong>Concessions et vendeurs de véhicules d&apos;occasion</strong> : une voiture propre se vend mieux et plus vite, l&apos;argument porte tout seul.</li>
          <li><strong>Auto-écoles</strong> : des véhicules utilisés toute la journée, un budget prévisible.</li>
          <li><strong>Sociétés avec flotte</strong> : artisans, commerciaux, services à domicile.</li>
        </UL>
        <P>
          L&apos;approche qui fonctionne est directe : passer sur place, proposer un premier véhicule
          à prix réduit, et laisser le résultat parler. C&apos;est un métier où le travail se voit
          immédiatement — servez-vous-en.
        </P>

        <H2>6. Relancer vos anciens clients</H2>
        <P>
          C&apos;est le canal le plus rentable, et presque personne ne l&apos;utilise. Une personne
          qui a déjà fait appel à vous, qui a été satisfaite, et qui connaît vos tarifs n&apos;a
          aucune raison d&apos;aller ailleurs. Elle a juste oublié — sa voiture s&apos;est resalie
          progressivement, sans déclic.
        </P>
        <P>
          Un message deux ou trois mois après la prestation suffit souvent à déclencher un nouveau
          rendez-vous. Pas une promotion, pas une relance commerciale insistante : un simple rappel
          que vous existez, au moment où le besoin est réapparu.
        </P>
        <P>
          Faites le calcul sur votre propre fichier : combien de clients servis il y a plus de trois
          mois et jamais revus ? Chez la plupart des laveurs, c&apos;est le plus gros gisement
          disponible, et il ne coûte rien à exploiter.
        </P>

        <H2>Ce sur quoi il ne faut pas compter au démarrage</H2>
        <P>
          Deux choses reviennent souvent et déçoivent presque toujours quand on débute :
        </P>
        <UL>
          <li>
            <strong>Les flyers dans les boîtes aux lettres.</strong>{' '}Le taux de retour est très
            faible, et vous touchez des gens qui n&apos;ont aucun besoin au moment où ils lisent —
            contrairement à quelqu&apos;un qui tape sa recherche sur Google.
          </li>
          <li>
            <strong>La publicité payante trop tôt.</strong>{' '}Tant que votre fiche Google est vide et
            que vous n&apos;avez pas d&apos;avis, payer pour amener du monde revient à remplir un
            seau percé. Construisez d&apos;abord la crédibilité, la publicité viendra l&apos;amplifier.
          </li>
        </UL>

        <H2>Par où commencer concrètement</H2>
        <P>
          Si vous ne deviez faire que trois choses, dans cet ordre :
        </P>
        <UL>
          <li>Créer ou compléter votre fiche d&apos;établissement Google, avec vos vraies photos.</li>
          <li>Demander systématiquement un avis après chaque prestation, le jour même.</li>
          <li>Relancer tous vos anciens clients de plus de trois mois.</li>
        </UL>
        <P>
          Ces trois actions ne coûtent rien d&apos;autre que de la régularité. C&apos;est
          précisément là que ça coince : les faire une fois ne sert à rien, il faut les faire à
          chaque client, chaque semaine. C&apos;est la raison pour laquelle la plupart des laveurs
          finissent par les automatiser.
        </P>

        <Cta title="Lave plus. Roule moins.">
          WashBoard s&apos;occupe des réservations, groupe vos rendez-vous par quartier, demande
          les avis à votre place et relance vos anciens clients. Vous lavez des voitures, on gère
          le reste.
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

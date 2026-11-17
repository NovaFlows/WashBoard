import type { Metadata } from 'next'
import { getArticle, SITE_URL } from '@/lib/blog'
import { lienPageMetierTraduit } from '@/lib/metiers'
import { PLAN_CARDS, requiredPlan, requiredPlanLabel } from '@/lib/plan'
import { tarifOffre } from '@/lib/resumeOffres'
import { H2, P, UL, A, Table, Summary, Faq, ArticleHeader, Cta, AlsoRead, ArticleJsonLd, type FaqItem } from '@/components/blog/Prose'
import { getTArticle as getT } from '@/lib/i18n/serveur'
import { imagePartage } from '@/lib/imagePartage'
import { alt as altImage } from '@/app/blog/lavage-flotte-vehicules-entreprise/opengraph-image'

const article = getArticle('lavage-flotte-vehicules-entreprise')!
const url = `${SITE_URL}/blog/${article.slug}`

// Offre qui ouvre la facturation : nom et tarif lus dans plan.ts, jamais recopiés.
const offreFacturation = PLAN_CARDS.find(c => c.key === requiredPlan('facturation'))!

// Ce que dit l'article du produit est vérifié dans le code :
// - client professionnel : raison sociale, SIRET (14 chiffres) et adresse de facturation saisis à
//   la réservation : components/booking/ContactDetails.tsx
// - plusieurs véhicules dans une réservation, quantité = nombre de véhicules, déplacement en
//   ligne séparée : lib/facture.ts (lignesFacture)
// - facture créée à « Terminé », envoyée par email au client professionnel seulement :
//   lib/facture.ts (doitEnvoyerFactureAuClient)
// - PDF : SIREN du client, nature « Prestation de services », pénalités de retard et indemnité
//   de 40 € pour un client professionnel, « paiement comptant le jour de la prestation » :
//   components/pdf/FacturePDF.tsx
// - TVA : franchise ou 20 / 10 / 5,5 %, numéro de TVA demandé si assujetti : lib/facture.ts
// - fiche entreprise (sites, contacts, délai de paiement convenu, devis en attente, factures
//   impayées), version mobile : components/dashboard/FicheEntrepriseV2.tsx
// - une facture par rendez-vous ; pas de facture mensuelle regroupée (aucune trace dans le code)

export const metadata: Metadata = {
  title: `${article.title} | WashBoard`,
  description: article.description,
  alternates: { canonical: url },
  openGraph: {
    images: imagePartage('/blog/lavage-flotte-vehicules-entreprise', altImage),
    type: 'article',
    url,
    title: article.title,
    description: article.description,
    publishedTime: article.publishedAt,
    modifiedTime: article.updatedAt,
    authors: ['WashBoard'],
    section: 'Clients professionnels',
  },
  twitter: { images: imagePartage('/blog/lavage-flotte-vehicules-entreprise', altImage), card: 'summary_large_image', title: article.title, description: article.description },
}


export default async function Page() {
  const t = await getT()
  const faq: FaqItem[] = [
    {
      question: t('Comment démarcher une concession, un loueur ou une auto-école quand on est laveur auto mobile ?'),
      answer:
        t('Allez sur place, aux heures creuses, et demandez la personne qui s’occupe des véhicules : responsable d’agence, chef d’atelier, gérant. Proposez de laver gratuitement ou à prix réduit un seul véhicule, laissez un devis écrit avec un tarif par véhicule et par passage, et rappelez quelques jours plus tard. Le travail se voit immédiatement : c’est votre meilleur argument.'),
    },
    {
      question: t('Faut-il un contrat pour laver les véhicules d’une entreprise ?'),
      answer:
        t('Un écrit vous protège des deux côtés dès que le travail est récurrent : périmètre, fréquence, prix hors taxes, délai de paiement, durée et préavis. Un devis accepté suffit souvent.'),
    },
    {
      question: t('Mon client professionnel reçoit-il sa facture par email avec WashBoard ?'),
      answer:
        t('Oui, s’il a réservé en tant que professionnel : sa facture lui part par email à la clôture du rendez-vous, avec sa raison sociale et son SIREN. WashBoard émet une facture par rendez-vous ; il n’y a pas de facture mensuelle regroupée à ce jour.'),
    },
  ]

  return (
    <>
      <ArticleJsonLd article={article} siteUrl={SITE_URL} faq={faq} />
      <article>
        <ArticleHeader
          article={article}
          intro={t('Un particulier lave sa voiture quelques fois par an. Une concession, un loueur, une auto-école ou une société avec des véhicules de service, c’est plusieurs véhicules au même endroit, un besoin qui revient et quelqu’un qui paie sur facture. Comment aller les chercher, quoi leur proposer, et comment facturer proprement.')}
        />

        <Summary
          items={[
            t('Le client professionnel vaut le détour pour une raison simple : plusieurs véhicules au même endroit, donc moins de trajet par véhicule lavé.'),
            t('Chaque cible achète pour une raison différente : l’image (auto-école), la rotation (loueur), la vente (concession), l’utilité (flotte de service). Parlez de la sienne.'),
            t('Chiffrez par véhicule et par passage, hors taxes, avec une remise de volume que vous avez calculée, pas devinée.'),
            t('Mettez-vous d’accord sur le délai de paiement avant le premier lavage, pas à la première facture.'),
            t('Ce qui ne marche pas : brader l’entrée, dépendre d’un seul client, travailler sans écrit, facturer tard.'),
          ]}
        />

        <P>
          {t('Les clients professionnels sont déjà évoqués dans')}{' '}
          <A href="/blog/trouver-des-clients-laveur-auto-mobile">{t('comment trouver des clients quand on est laveur auto mobile')}</A>{t('. Cet article va plus loin sur ce qui change vraiment avec eux : la façon de les approcher, de les chiffrer, de se faire payer et de ne pas se retrouver dépendant d’un seul.')}
        </P>

        <H2>{t('Qui démarcher, et pourquoi chacun achète')}</H2>
        <P>
          {t('Ne présentez pas la même offre à tous. Chaque cible a une raison différente de payer un lavage, et c’est cette raison qu’il faut dire en premier. Le tableau suivant est un raisonnement de bon sens, pas une enquête : validez-le en posant la question.')}
        </P>
        <Table
          head={[t('Cible'), t('Pourquoi elle achète'), t('Qui décide, à vérifier sur place')]}
          rows={[
            [t('Concession, vendeur de véhicules d’occasion'), t('Une voiture propre se montre et se vend mieux ; préparation avant livraison'), t('Chef d’atelier, responsable de la préparation ou directeur')],
            [t('Loueur de voitures ou d’utilitaires'), t('Remettre rapidement en service des véhicules qui reviennent sales'), t('Responsable d’agence')],
            [t('Auto-école'), t('Des véhicules vus par chaque élève, utilisés toute la journée'), t('Gérant')],
            [t('Entreprise avec flotte (artisans, commerciaux, services à domicile)'), t('L’image de l’entreprise chez ses propres clients'), t('Dirigeant, office manager ou responsable de flotte')],
            [t('Garage ou carrossier'), t('Rendre le véhicule propre au client qui le récupère'), t('Gérant ou chef d’atelier')],
          ]}
        />

        <H2>{t('Les démarcher : l’approche qui évite le mur du standard')}</H2>
        <P>
          {t('Un laveur mobile a un avantage sur n’importe quel prospect : il se présente avec la preuve dans le coffre. Déplacez-vous plutôt que d’envoyer un mail qui ne sera pas lu :')}
        </P>
        <UL>
          <li><strong>{t('Passez aux heures creuses')}</strong>{' '}{t('(pas à l’ouverture, pas à la fermeture) et demandez la personne qui s’occupe des véhicules, pas « le patron ».')}</li>
          <li><strong>{t('Proposez un essai sur un seul véhicule')}</strong>{' '}{t('à prix réduit ou offert, devant eux si possible. Un avant/après vu de ses yeux convainc mieux que dix photos.')}</li>
          <li><strong>{t('Laissez un devis écrit')}</strong>{' '}{t('avec un tarif par véhicule et par passage (voir')}{' '}<A href="/blog/devis-lavage-auto-domicile">{t('faire un devis de lavage auto à domicile')}</A>{t('). Un prospect qui hésite doit pouvoir le transmettre à celui qui décide.')}</li>
          <li><strong>{t('Relancez une fois')}</strong>{' '}{t('quelques jours plus tard, avec une question précise (« combien de véhicules ? à quelle fréquence ? ») plutôt qu’un « avez-vous réfléchi ? ».')}</li>
        </UL>
        <P>
          {t('Sur un site d’entreprise, une question pratique décide de tout : où l’eau peut-elle s’écouler, et y a-t-il un point d’eau et d’électricité ? Demandez-le avant de chiffrer. Si la réponse est « nulle part », le')}{' '}
          <A href="/blog/lavage-auto-sans-eau">{t('lavage sans eau')}</A>{' '}{t('règle le sujet.')}
        </P>

        <H2>{t('Chiffrer : par véhicule, par passage, hors taxes')}</H2>
        <P>
          {t('Un professionnel raisonne souvent hors taxes et par véhicule. Donnez-lui une grille qu’il peut relire en dix secondes : un prix HT par véhicule et par passage, une remise de volume écrite, et les frais de déplacement soit inclus, soit sur une ligne à part.')}
        </P>
        <P>
          {t('Calculez votre remise au lieu de l’accorder à l’oreille. Exemple chiffré, prix et durées indicatifs, à remplacer par les vôtres : un lavage extérieur à 55 € pour un particulier, dans la fourchette des')}{' '}
          <A href="/blog/tarifs-lavage-auto-domicile">{t('tarifs du lavage auto à domicile')}</A>{t(', une quarantaine de minutes de travail. Pour six véhicules au même endroit, il n’y a plus de trajet entre deux prestations : une remise de 10 % ramène chaque véhicule à 49,50 €, soit 297 € pour environ quatre heures de lavage, environ 74 € de l’heure avant charges. Si ce chiffre est supérieur à ce que vous gagnez chez les particuliers trajets compris, la remise est tenable. S’il est inférieur, ce n’est pas un tarif de volume, c’est une perte.')}
        </P>

        <H2>{t('Un contrat, ou au moins un écrit')}</H2>
        <P>
          {t('Dès que le travail est récurrent, ne vous passez pas d’un écrit (un devis accepté suffit souvent, un contrat court mieux encore). Il doit dire :')}
        </P>
        <UL>
          <li>{t('le périmètre : quels véhicules, à quelle adresse, à quel emplacement ;')}</li>
          <li>{t('les prestations incluses et la fréquence (toutes les semaines, deux fois par mois) ;')}</li>
          <li>{t('le prix hors taxes par véhicule et par passage, et ce qui est facturé en plus ;')}</li>
          <li>{t('l’accès à l’eau, à l’électricité, et les créneaux autorisés ;')}</li>
          <li>{t('l’annulation et les intempéries : qui décale, qui facture ;')}</li>
          <li>{t('le délai de paiement ;')}</li>
          <li>{t('la durée et le préavis de résiliation, dans les deux sens ;')}</li>
          <li>{t('la responsabilité en cas de dommage, et qui la prend en charge.')}</li>
        </UL>

        <H2>{t('Se faire payer : ce qui change avec une entreprise')}</H2>
        <P>
          {t('Une entreprise ne paie pas en main propre à la fin du lavage : elle paie sur facture, souvent plus tard, et la range dans sa comptabilité. Trois habitudes évitent d’attendre :')}
        </P>
        <UL>
          <li><strong>{t('Convenez du délai à l’avance')}</strong>{' '}{t('et écrivez-le sur le devis, plutôt que de le découvrir à la première relance.')}</li>
          <li><strong>{t('Facturez le jour même')}</strong>{t(', avec sa raison sociale et le détail par véhicule : une facture incomplète revient, et repart en bas de la pile.')}</li>
          <li><strong>{t('Demandez à qui l’envoyer')}</strong>{' '}{t(': le responsable d’agence qui vous a fait venir n’est pas toujours celui qui paie.')}</li>
        </UL>

        <H2>{t('Ce qui ne marche pas')}</H2>
        <UL>
          <li>
            <strong>{t('Brader l’entrée.')}</strong>{' '}{t('Un premier véhicule offert ouvre la porte ; un tarif de volume trop bas la referme sur votre marge. L’essai sert à convaincre, il ne fixe pas la grille.')}
          </li>
          <li>
            <strong>{t('Dépendre d’un seul client.')}</strong>{' '}{t('Un loueur ou une concession qui représente la moitié de votre chiffre d’affaires peut vous quitter du jour au lendemain, ou retarder ses paiements, et vous n’avez plus d’agenda de remplacement. Gardez des particuliers dans votre planning.')}
          </li>
          <li>
            <strong>{t('Accepter un délai de paiement sans l’avoir calculé.')}</strong>{' '}{t('À 60 jours, vous avancez deux mois de carburant, de produits et de cotisations. Ne le découvrez pas en fin de mois.')}
          </li>
          <li>
            <strong>{t('Travailler sans écrit.')}</strong>{' '}{t('« On s’arrange » tient jusqu’au premier dommage, au premier retard de paiement, ou au changement de responsable d’agence.')}
          </li>
          <li>
            <strong>{t('Facturer tard.')}</strong>{' '}{t('Une facture envoyée un mois plus tard est payée un mois plus tard. Émettez-la le jour de la prestation.')}
          </li>
          <li>
            <strong>{t('Couvrir tout seul une flotte trop grande.')}</strong>{' '}{t('Au-delà de ce que vous pouvez laver en une demi-journée, vous manquez de temps pour vos autres clients. Annoncez dès le début le nombre de véhicules que vous prenez.')}
          </li>
        </UL>

        <H2>{t('Ce que fait WashBoard pour un client professionnel')}</H2>
        <P>
          {t('Un client qui réserve en tant que professionnel saisit sa raison sociale, son SIRET et son adresse de facturation. S’il réserve plusieurs véhicules, la facture reprend chaque véhicule, avec le déplacement sur une ligne séparée. Elle est créée quand vous marquez le rendez-vous « Terminé » et lui part par email : son SIREN, extrait du SIRET qu’il a saisi, y figure, avec la nature « prestation de services », le taux des pénalités de retard et l’indemnité de 40 €. Côté vous, votre SIRET est contrôlé à la saisie, et la TVA est soit la franchise, soit un taux de 20 %, 10 % ou 5,5 % avec votre numéro de TVA.')}
        </P>
        <P>
          {t('Trois limites à connaître. WashBoard émet une facture par rendez-vous : il n’y a pas de facture mensuelle regroupée. La facture générée indique un paiement comptant le jour de la prestation : un délai de 30 jours négocié se retrouve dans votre contrat ou votre devis, pas sur le PDF. Enfin, WashBoard n’est pas raccordé à une plateforme agréée de facturation électronique aujourd’hui : voir la')}{' '}
          <A href="/facturation-laveur-auto">{t('page facturation')}</A>{' '}{t('pour où nous en sommes.')}
        </P>

        <Faq items={faq} />

        <Cta
          title={t('Des clients pros, des factures qui tiennent')}
          secondary={lienPageMetierTraduit(t, article.theme)}
        >
          {t('Avec WashBoard, en formule')} {requiredPlanLabel('facturation')} ({tarifOffre(offreFacturation).replace('/mois', t('/mois'))}{t('), un client professionnel réserve plusieurs véhicules d’un coup, sa facture est créée à la fin du rendez-vous avec son SIREN, et elle lui part par email. Dans la version mobile, la fiche entreprise regroupe ses contacts, ses sites, ses véhicules, ses devis en attente et le délai de paiement convenu, et vous écrivez un devis chez lui, sur place. Un tampon par véhicule est possible sur la carte de fidélité, pour que la fidélité d’une flotte avance au rythme de son volume.')}
        </Cta>

        <AlsoRead
          items={[
            { href: '/blog/trouver-des-clients-laveur-auto-mobile', label: t('Comment trouver des clients quand on est laveur auto mobile') },
            { href: '/blog/devis-lavage-auto-domicile', label: t('Faire un devis de lavage auto à domicile : quand, quoi écrire, modèle à recopier') },
            { href: '/blog/carte-de-fidelite-laveur-auto-mobile', label: t('Carte de fidélité pour laveur auto mobile : faire revenir ses clients') },
            { href: '/blog/organiser-ses-tournees-lavage-auto', label: t('Organiser ses tournées pour laver plus de voitures par jour') },
          ]}
        />
      </article>
    </>
  )
}

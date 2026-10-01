import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Politique de confidentialité — WashBoard',
  robots: { index: false },
}

export default function Confidentialite() {
  return (
    <article className="prose prose-slate dark:prose-invert max-w-none">
      <h1 className="text-3xl font-extrabold tracking-tight mb-2">Politique de confidentialité</h1>
      <p className="text-sm text-slate-400 mb-10">Dernière mise à jour : juillet 2026</p>

      <Section title="1. Responsable du traitement">
        <p>
          Le responsable du traitement des données personnelles collectées via washboard.fr est :
        </p>
        <ul>
          <li><strong>Dénomination :</strong> <Placeholder>NOM LÉGAL</Placeholder></li>
          <li><strong>Email :</strong> novaflows.pro@gmail.com</li>
          <li><strong>Adresse :</strong> <Placeholder>ADRESSE COMPLÈTE</Placeholder></li>
        </ul>
      </Section>

      <Section title="2. Données collectées">
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-2">2.1 Données des laveurs (utilisateurs du logiciel)</h3>
        <ul>
          <li>Nom, prénom, email, numéro de téléphone</li>
          <li>Nom commercial et informations sur l&apos;activité (zone d&apos;intervention, prestations, tarifs)</li>
          <li>Données de connexion (email, mot de passe chiffré)</li>
          <li>Données comptables saisies (chiffre d&apos;affaires, dépenses)</li>
        </ul>
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-2 mt-4">2.2 Données des clients des laveurs (via page de réservation)</h3>
        <ul>
          <li>Nom, prénom, email, numéro de téléphone</li>
          <li>Adresse du lieu d&apos;intervention</li>
          <li>Détails de la réservation (service, véhicule, créneau, prix)</li>
        </ul>
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-2 mt-4">2.3 Données de navigation</h3>
        <ul>
          <li>Adresse IP (utilisée uniquement pour la protection anti-spam des formulaires)</li>
          <li>
            Mesure d&apos;audience interne : nombre de visites, étapes franchies dans le
            formulaire, et origine du lien cliqué. Aucune donnée personnelle, aucun partage
            avec un tiers, aucun profilage.
          </li>
          <li>
            Sur la page de réservation d&apos;un prestataire qui l&apos;a activé, et
            uniquement après votre accord : le Pixel Meta (voir §7)
          </li>
        </ul>
      </Section>

      <Section title="3. Finalités du traitement">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-left py-2 pr-4 font-semibold text-slate-700 dark:text-slate-300">Finalité</th>
              <th className="text-left py-2 font-semibold text-slate-700 dark:text-slate-300">Base légale</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {[
              ['Gestion du compte laveur et accès au logiciel', 'Exécution du contrat'],
              ["Envoi des emails de confirmation de réservation", 'Exécution du contrat'],
              ["Envoi des demandes d’avis Google aux clients", 'Intérêt légitime'],
              ["Protection anti-spam (rate-limiting par IP)", 'Intérêt légitime'],
              ["Facturation et gestion de l’abonnement", 'Obligation légale / contrat'],
              ["Suppression des comptes après résiliation (purge 30j)", 'Obligation légale / contrat'],
            ].map(([fin, base]) => (
              <tr key={fin}>
                <td className="py-2 pr-4">{fin}</td>
                <td className="py-2 text-slate-500">{base}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="4. Durée de conservation">
        <ul>
          <li><strong>Données des laveurs actifs :</strong> pendant toute la durée de l&apos;abonnement</li>
          <li><strong>Après résiliation :</strong> 30 jours (délai de réactivation possible), puis suppression définitive</li>
          <li><strong>Données de réservation des clients finaux :</strong> conservées pendant la durée du contrat avec le laveur, puis supprimées avec le compte</li>
          <li><strong>Adresses IP (anti-spam) :</strong> non persistées — stockées en mémoire vive uniquement (supprimées au redémarrage du serveur)</li>
        </ul>
      </Section>

      <Section title="5. Sous-traitants (tiers destinataires)">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-left py-2 pr-4 font-semibold text-slate-700 dark:text-slate-300">Prestataire</th>
              <th className="text-left py-2 pr-4 font-semibold text-slate-700 dark:text-slate-300">Rôle</th>
              <th className="text-left py-2 font-semibold text-slate-700 dark:text-slate-300">Localisation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {[
              ['Supabase Inc.', 'Base de données (stockage des données)', 'UE (eu-west-1)'],
              ['Vercel Inc.', "Hébergement de l’application web", 'USA / CDN mondial'],
              ['Resend Inc.', 'Envoi des emails transactionnels', 'USA'],
              ['Google LLC', 'Geocoding / Maps (calcul des zones)', 'USA'],
              ['Stripe Inc.', 'Paiement en ligne sécurisé', 'USA'],
            ].map(([p, r, l]) => (
              <tr key={p}>
                <td className="py-2 pr-4 font-medium">{p}</td>
                <td className="py-2 pr-4 text-slate-500">{r}</td>
                <td className="py-2 text-slate-500">{l}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3">
          Les transferts hors UE sont encadrés par les clauses contractuelles types de la Commission européenne ou
          le mécanisme EU-US Data Privacy Framework selon les prestataires.
        </p>
      </Section>

      <Section title="6. Vos droits (RGPD)">
        <p>Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits suivants :</p>
        <ul>
          <li><strong>Droit d&apos;accès :</strong> obtenir une copie de vos données personnelles</li>
          <li><strong>Droit de rectification :</strong> corriger des données inexactes ou incomplètes</li>
          <li><strong>Droit à l&apos;effacement :</strong> demander la suppression de vos données</li>
          <li><strong>Droit à la portabilité :</strong> recevoir vos données dans un format structuré</li>
          <li><strong>Droit d&apos;opposition :</strong> vous opposer à un traitement basé sur l&apos;intérêt légitime</li>
          <li><strong>Droit à la limitation :</strong> limiter le traitement de vos données</li>
        </ul>
        <p>
          Pour exercer ces droits, contactez-nous à <strong>novaflows.pro@gmail.com</strong>. Nous répondons dans un
          délai maximum de 30 jours.
        </p>
        <p>
          Vous pouvez également introduire une réclamation auprès de la <strong>CNIL</strong> (Commission Nationale
          de l&apos;Informatique et des Libertés) : <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">www.cnil.fr</a>.
        </p>
      </Section>

      <Section title="7. Cookies et traceurs">
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-2">7.1 Sans consentement</h3>
        <p>
          Ces éléments sont strictement nécessaires au service ou relèvent de la mesure
          d&apos;audience exemptée de consentement. Ils ne sont jamais partagés et ne servent
          à aucun ciblage publicitaire.
        </p>
        <ul>
          <li><strong>Cookie de session :</strong> nécessaire à l&apos;authentification des laveurs (cookie Supabase sécurisé, HttpOnly)</li>
          <li><strong>Préférence d&apos;affichage :</strong> mémorise le thème clair ou sombre (stockage local, aucune donnée personnelle)</li>
          <li>
            <strong>Mesure d&apos;audience interne :</strong> un identifiant de visite limité à
            l&apos;onglet, et l&apos;origine du lien cliqué (campagne publicitaire du prestataire),
            conservée 30 jours dans votre navigateur. Ces informations décrivent une
            annonce, pas une personne : elles ne permettent pas de vous identifier, ne
            quittent jamais WashBoard et ne sont recoupées avec aucun autre site.
          </li>
        </ul>

        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-2 mt-4">7.2 Avec votre consentement : le Pixel Meta</h3>
        <p>
          Certains prestataires font de la publicité sur Facebook et Instagram. Ceux-là
          peuvent activer le <strong>Pixel Meta</strong> sur leur propre page de réservation,
          afin de mesurer l&apos;efficacité de leurs annonces.
        </p>
        <p>
          Le Pixel est un traceur de la société Meta Platforms Ireland Limited. Il dépose des
          cookies et transmet à Meta votre consultation de la page ainsi que, le cas échéant,
          le fait que vous ayez commencé puis validé une réservation et son montant. Ces
          données peuvent servir à vous proposer des annonces ciblées.
        </p>
        <ul>
          <li>
            <strong>Rien n&apos;est chargé avant votre accord.</strong> Tant que vous n&apos;avez
            pas cliqué sur « Accepter », le script de Meta n&apos;est pas présent dans la page
            et aucun cookie n&apos;est déposé.
          </li>
          <li>
            <strong>Refuser est aussi simple qu&apos;accepter</strong>, et n&apos;empêche en rien
            de réserver.
          </li>
          <li>
            <strong>Votre choix vaut pour ce prestataire seulement</strong>, et il est
            conservé 6 mois sur votre appareil. Passé ce délai, la question vous est reposée.
          </li>
          <li>
            <strong>Vous pouvez en changer à tout moment</strong> via le lien « Gérer mes
            cookies » en bas de la page de réservation concernée.
          </li>
          <li>
            Le bandeau n&apos;apparaît que sur les pages des prestataires ayant activé le
            Pixel. Sur toutes les autres, aucun traceur publicitaire n&apos;existe.
          </li>
        </ul>
        <p>
          Base légale : votre consentement (article 6.1.a du RGPD et article 82 de la loi
          Informatique et Libertés). Le prestataire qui active le Pixel est responsable de
          traitement conjoint avec Meta pour cette mesure. Les conditions de Meta sont
          consultables sur{' '}
          <a
            href="https://www.facebook.com/privacy/policy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            facebook.com/privacy/policy
          </a>.
        </p>
      </Section>

      <Section title="8. Sécurité">
        <p>
          WashBoard met en œuvre les mesures techniques et organisationnelles appropriées pour protéger vos données :
          chiffrement des mots de passe (gestion par Supabase Auth), connexions HTTPS, accès aux données restreint
          par des politiques RLS (Row Level Security) en base de données, clés d&apos;API serveur non exposées au navigateur.
        </p>
      </Section>

      <Section title="9. Modifications">
        <p>
          La présente politique peut être mise à jour à tout moment. La date de dernière mise à jour est indiquée
          en haut de cette page. En cas de modification substantielle, les utilisateurs seront informés par email.
        </p>
      </Section>
    </article>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-3">{title}</h2>
      <div className="text-slate-600 dark:text-slate-400 space-y-2 text-sm leading-relaxed">{children}</div>
    </section>
  )
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-1 rounded font-mono text-xs">
      [{children}]
    </span>
  )
}

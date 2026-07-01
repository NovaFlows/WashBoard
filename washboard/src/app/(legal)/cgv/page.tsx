import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Conditions Générales de Vente — WashBoard',
  robots: { index: false },
}

export default function CGV() {
  return (
    <article className="prose prose-slate dark:prose-invert max-w-none">
      <h1 className="text-3xl font-extrabold tracking-tight mb-2">Conditions Générales de Vente</h1>
      <p className="text-sm text-slate-400 mb-10">Dernière mise à jour : juillet 2026</p>

      <Section title="1. Objet">
        <p>
          Les présentes Conditions Générales de Vente (ci-après « CGV ») régissent les relations contractuelles entre
          <strong> <Placeholder>NOM LÉGAL</Placeholder></strong> (ci-après « WashBoard ») et tout professionnel souscrivant
          à l'abonnement au logiciel <strong>WashBoard</strong> accessible sur washboard.fr (ci-après « le Client »).
        </p>
        <p>
          Toute souscription à l'abonnement implique l'acceptation pleine et entière des présentes CGV.
        </p>
      </Section>

      <Section title="2. Description du service">
        <p>
          WashBoard est un logiciel SaaS (Software as a Service) de gestion destiné aux laveurs automobiles mobiles et
          prestataires de detailing à domicile. Il comprend notamment :
        </p>
        <ul>
          <li>Une page de réservation en ligne personnalisée par client</li>
          <li>Un agenda de gestion des rendez-vous avec créneaux optimisés par zone géographique</li>
          <li>Un CRM clients (particuliers et professionnels)</li>
          <li>Des outils de comptabilité et de suivi d'activité</li>
          <li>La confirmation automatique des réservations par email</li>
        </ul>
        <p>
          Les fonctionnalités disponibles dépendent du plan souscrit (Essentiel, Pro, Business).
          Les plans Pro et Business sont actuellement en cours de développement.
        </p>
      </Section>

      <Section title="3. Tarifs et facturation">
        <p>L'abonnement WashBoard est proposé aux tarifs suivants :</p>
        <ul>
          <li><strong>Essentiel :</strong> 49 € HT / mois</li>
          <li><strong>Pro :</strong> 69 € HT / mois (disponible prochainement)</li>
          <li><strong>Business :</strong> 99 € HT / mois (disponible prochainement)</li>
        </ul>
        <p>
          Tous les prix sont exprimés en euros hors taxes. La TVA applicable est celle en vigueur au moment de la facturation.
        </p>
        <p>
          L'abonnement est à renouvellement mensuel automatique. La facturation intervient chaque mois à la date anniversaire
          de la souscription.
        </p>
      </Section>

      <Section title="4. Période d'essai">
        <p>
          Tout nouveau Client bénéficie d'une période d'essai gratuite d'<strong>un (1) mois</strong> à compter de la création
          de son compte, sans engagement et sans carte bancaire requise.
        </p>
        <p>
          À l'issue de la période d'essai, le compte est suspendu automatiquement si aucun abonnement payant n'est souscrit.
          Les données sont conservées pendant 30 jours supplémentaires, puis supprimées définitivement.
        </p>
      </Section>

      <Section title="5. Modalités de paiement">
        <p>
          Le paiement s'effectue par virement bancaire ou tout autre moyen convenu entre les parties.
          L'intégration d'un paiement en ligne par carte bancaire (via Stripe) est en cours de déploiement.
        </p>
        <p>
          En cas de défaut de paiement à l'échéance, WashBoard se réserve le droit de suspendre l'accès au service
          après mise en demeure restée sans réponse pendant 7 jours.
        </p>
      </Section>

      <Section title="6. Résiliation">
        <p>
          Le Client peut résilier son abonnement à tout moment, sans frais ni pénalité, depuis la section
          <strong> Paramètres → Général → Désactiver le compte</strong> de son espace ou par email à
          novaflows.pro@gmail.com.
        </p>
        <p>
          La résiliation prend effet à la fin de la période mensuelle en cours. Aucun remboursement prorata
          n'est effectué pour les jours restants.
        </p>
        <p>
          WashBoard peut résilier l'abonnement en cas de manquement grave aux présentes CGV, après mise en demeure
          restée sans effet pendant 15 jours.
        </p>
      </Section>

      <Section title="7. Disponibilité du service">
        <p>
          WashBoard s'engage à mettre en œuvre tous les moyens raisonnables pour assurer la disponibilité du service
          24h/24 et 7j/7. Des interruptions ponctuelles pour maintenance ou raisons techniques peuvent survenir.
          WashBoard s'efforce d'en informer les Clients à l'avance lorsque cela est possible.
        </p>
        <p>
          WashBoard ne saurait être tenu responsable d'interruptions de service liées à des tiers (hébergeur, fournisseur
          d'accès internet, force majeure).
        </p>
      </Section>

      <Section title="8. Propriété des données">
        <p>
          Les données saisies par le Client dans WashBoard (clients, réservations, prestations) lui appartiennent
          intégralement. WashBoard n'exploite pas ces données à des fins commerciales.
        </p>
        <p>
          En cas de résiliation, le Client peut demander l'export de ses données dans un délai de 30 jours à
          novaflows.pro@gmail.com. Passé ce délai, les données sont supprimées conformément à notre
          politique de confidentialité.
        </p>
      </Section>

      <Section title="9. Responsabilité">
        <p>
          La responsabilité de WashBoard est limitée aux dommages directs prouvés, dans la limite des sommes
          effectivement versées par le Client au cours des 3 derniers mois précédant le fait générateur.
          WashBoard ne saurait être tenu responsable de pertes d'exploitation, de chiffre d'affaires ou de clientèle.
        </p>
      </Section>

      <Section title="10. Modifications des CGV">
        <p>
          WashBoard se réserve le droit de modifier les présentes CGV à tout moment. Le Client sera informé par
          email au moins 30 jours avant l'entrée en vigueur des nouvelles conditions. La poursuite de l'utilisation
          du service après cette date vaut acceptation des nouvelles CGV.
        </p>
      </Section>

      <Section title="11. Droit applicable et litiges">
        <p>
          Les présentes CGV sont soumises au droit français. En cas de litige, les parties s'engagent à rechercher
          une solution amiable avant tout recours judiciaire. À défaut d'accord, les tribunaux du ressort du siège
          social de WashBoard seront seuls compétents.
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

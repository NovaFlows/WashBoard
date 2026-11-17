import type { Metadata } from 'next'
import { PLAN_CARDS, formatEuros, yearlyPrice, freeMonthsLabel } from '@/lib/plan'

export const metadata: Metadata = {
  title: 'Conditions Générales de Vente — WashBoard',
  robots: { index: false },
}

export default function CGV() {
  return (
    <article className="lg">
      <h1>Conditions Générales de Vente</h1>
      <p className="lg-maj">Dernière mise à jour : novembre 2026</p>

      <Section title="1. Objet">
        <p>
          Les présentes Conditions Générales de Vente (ci-après « CGV ») régissent les relations contractuelles entre
          <strong> NovaFlows SAS</strong> (ci-après « WashBoard ») et tout professionnel souscrivant
          à l&apos;abonnement au logiciel <strong>WashBoard</strong> accessible sur washboard.fr (ci-après « le Client »).
        </p>
        <p>
          Toute souscription à l&apos;abonnement implique l&apos;acceptation pleine et entière des présentes CGV.
        </p>
      </Section>

      <Section title="2. Description du service">
        <p>
          WashBoard est un logiciel SaaS (Software as a Service) de gestion destiné aux professionnels du nettoyage
          et de l&apos;entretien à domicile (lavage de véhicules, detailing, ménage, entretien de piscine, etc.). Il comprend notamment :
        </p>
        <ul>
          <li>Une page de réservation en ligne personnalisée par client</li>
          <li>Un agenda de gestion des rendez-vous avec créneaux optimisés par zone géographique</li>
          <li>Un CRM clients (particuliers et professionnels)</li>
          <li>Des outils de comptabilité et de suivi d&apos;activité</li>
          <li>La confirmation automatique des réservations par email</li>
        </ul>
        <p>
          Les fonctionnalités disponibles dépendent du plan souscrit (Découverte, Starter, Pro, Business).
        </p>
      </Section>

      <Section title="3. Tarifs et facturation">
        <p>L&apos;abonnement WashBoard est proposé aux tarifs suivants :</p>
        <ul>
          {/* Tarifs tirés de `plan.ts` : écrits en dur, des CGV finissent par
              annoncer un prix que le produit ne pratique plus. */}
          {PLAN_CARDS.map(c => (
            <li key={c.key}>
              <strong>{c.name} :</strong>{' '}
              {/* Une offre sans tarif public ne peut pas en afficher un ici :
                  des CGV qui annoncent un prix que le produit ne pratique plus
                  engagent l'éditeur sur ce prix. */}
              {c.surDevis ? (
                <>tarif sur devis, établi après entretien et fonction du nombre de laveurs.</>
              ) : (
                <>
                  {formatEuros(c.price)} € HT / mois,
                  ou {formatEuros(yearlyPrice(c.price))} € HT / an ({freeMonthsLabel()})
                </>
              )}
            </li>
          ))}
        </ul>
        <p>
          L&apos;engagement annuel est facturé en une fois pour douze mois. Les tarifs
          mensuels équivalents affichés (40,83 € et 57,50 €) sont indicatifs.
        </p>
        <p>
          Tous les prix sont exprimés en euros hors taxes. La TVA applicable est celle en vigueur au moment de la facturation.
        </p>
        <p>
          WashBoard est ouvert aux laveurs établis en France, en Belgique et en Suisse. Chaque laveur reste responsable des mentions
          légales et de la TVA de ses propres factures, selon le droit du pays où il est établi.
        </p>
        <p>
          L&apos;abonnement est à renouvellement mensuel automatique. La facturation intervient chaque mois à la date anniversaire
          de la souscription.
        </p>
      </Section>

      <Section title="4. Période d'essai">
        <p>
          Tout nouveau Client bénéficie d&apos;une période d&apos;essai gratuite de <strong>quatorze (14) jours</strong> à compter de la
          création de son compte, sans engagement et sans carte bancaire requise. Les comptes créés avant la présente version
          conservent la durée d&apos;essai et la date de fin qui leur avaient été indiquées.
        </p>
        <p>
          À l&apos;issue de la période d&apos;essai, si aucun abonnement payant n&apos;a été souscrit, le compte passe automatiquement
          sur l&apos;offre gratuite Découverte, avec les fonctionnalités et limites propres à cette offre. Aucune somme n&apos;est due
          et le Client peut souscrire une offre payante à tout moment.
        </p>
        <p>
          Le Client inscrit avec un code de parrainage bénéficie d&apos;une période d&apos;essai plus longue, dans les conditions de
          l&apos;article 5.
        </p>
      </Section>

      <Section title="5. Parrainage">
        <h3>5.1 Principe</h3>
        <p>
          Tout Client disposant d&apos;un compte WashBoard (le « Parrain ») peut recommander WashBoard à un autre professionnel
          (le « Filleul »). Chaque Parrain dispose d&apos;un code personnel, au format NOM-XXXX, et d&apos;un lien d&apos;inscription
          qui le contient. Le nombre de Filleuls par Parrain n&apos;est pas plafonné.
        </p>

        <h3>5.2 Conditions</h3>
        <ul>
          <li>
            Le code se saisit uniquement lors de l&apos;inscription du Filleul, ou en utilisant le lien d&apos;inscription du Parrain.
            Il ne peut pas être ajouté après la création du compte.
          </li>
          <li>Un Filleul n&apos;a qu&apos;un seul Parrain.</li>
          <li>
            Il est interdit de se parrainer soi-même, y compris au moyen d&apos;un second compte ou d&apos;un compte créé pour
            le compte d&apos;une même personne ou d&apos;une même activité.
          </li>
        </ul>

        <h3>5.3 Avantage du Filleul</h3>
        <p>
          Le Filleul bénéficie de quatorze (14) jours d&apos;essai supplémentaires, soit <strong>vingt-huit (28) jours d&apos;essai
          au total</strong> au lieu de quatorze (14). Les autres conditions de la période d&apos;essai (article 4) restent
          inchangées.
        </p>

        <h3>5.4 Avantage du Parrain</h3>
        <p>
          Le Parrain reçoit <strong>un (1) mois offert</strong> lorsque son Filleul règle son premier paiement d&apos;une offre
          payante (Starter, Pro ou Business, en abonnement mensuel ou annuel). Un seul mois est offert par Filleul, y compris
          lorsque le Filleul paie à l&apos;année. Le mois est attribué une fois le paiement confirmé par WashBoard.
        </p>
        <p>Le mois offert prend la forme suivante, selon la situation du Parrain à ce moment :</p>
        <ul>
          <li>
            <strong>Parrain en offre Découverte ou Starter :</strong> un mois en offre Pro, puis retour automatique à son
            offre. Un Parrain Starter reste Starter ensuite, et son paiement suivant est décalé d&apos;un mois.
          </li>
          <li>
            <strong>Parrain en offre Pro ou Business :</strong> un mois gratuit dans son offre ; sa prochaine échéance est décalée
            d&apos;un mois.
          </li>
          <li>
            <strong>Parrain en période d&apos;essai :</strong> son essai est prolongé d&apos;un mois.
          </li>
          <li>
            <strong>Client conservant d&apos;anciens tarifs :</strong> aucun avantage pour le Parrain. Son Filleul garde en
            revanche ses quatorze (14) jours d&apos;essai supplémentaires.
          </li>
        </ul>

        <h3>5.5 Nature de l&apos;avantage</h3>
        <p>
          Les avantages du parrainage ne sont ni remboursables, ni convertibles en argent, ni cessibles. Ils ne donnent lieu
          à aucun versement.
        </p>

        <h3>5.6 Fraude et abus</h3>
        <p>
          En cas de fraude ou d&apos;abus manifeste (faux comptes, auto-parrainage déguisé, détournement du code), WashBoard
          peut refuser ou retirer l&apos;avantage concerné, annuler un mois déjà accordé et, le cas échéant, suspendre le
          parrainage du compte. Pour détecter ces abus, WashBoard conserve certaines données liées à l&apos;inscription, comme
          indiqué dans la politique de confidentialité.
        </p>

        <h3>5.7 Évolution du programme</h3>
        <p>
          WashBoard peut modifier ou arrêter le programme de parrainage à tout moment. Les avantages déjà acquis restent dus.
        </p>
      </Section>

      <Section title="6. Modalités de paiement">
        <p>
          Le paiement s&apos;effectue par carte bancaire via Stripe, plateforme de paiement sécurisée certifiée PCI DSS.
          WashBoard ne stocke aucune donnée bancaire.
        </p>
        <p>
          En cas de défaut de paiement à l&apos;échéance, WashBoard se réserve le droit de suspendre l&apos;accès au service
          après mise en demeure restée sans réponse pendant 7 jours.
        </p>
      </Section>

      <Section title="7. Résiliation">
        <p>
          Le Client peut résilier son abonnement à tout moment, sans frais ni pénalité, depuis le portail de gestion
          accessible via la section <strong>Abonnement</strong> de son espace ou par email à novaflows.pro@gmail.com.
        </p>
        <p>
          La résiliation prend effet à la fin de la période mensuelle en cours. Aucun remboursement prorata
          n&apos;est effectué pour les jours restants.
        </p>
        <p>
          WashBoard peut résilier l&apos;abonnement en cas de manquement grave aux présentes CGV, après mise en demeure
          restée sans effet pendant 15 jours.
        </p>
      </Section>

      <Section title="8. Disponibilité du service">
        <p>
          WashBoard s&apos;engage à mettre en œuvre tous les moyens raisonnables pour assurer la disponibilité du service
          24h/24 et 7j/7. Des interruptions ponctuelles pour maintenance ou raisons techniques peuvent survenir.
          WashBoard s&apos;efforce d&apos;en informer les Clients à l&apos;avance lorsque cela est possible.
        </p>
        <p>
          WashBoard ne saurait être tenu responsable d&apos;interruptions de service liées à des tiers (hébergeur, fournisseur
          d&apos;accès internet, force majeure).
        </p>
      </Section>

      <Section title="9. Propriété des données">
        <p>
          Les données saisies par le Client dans WashBoard (clients, réservations, prestations) lui appartiennent
          intégralement. WashBoard n&apos;exploite pas ces données à des fins commerciales.
        </p>
        <p>
          En cas de résiliation, le Client peut demander l&apos;export de ses données dans un délai de 30 jours à
          novaflows.pro@gmail.com. Passé ce délai, les données sont supprimées conformément à notre
          politique de confidentialité.
        </p>
      </Section>

      <Section title="10. Responsabilité">
        <p>
          La responsabilité de WashBoard est limitée aux dommages directs prouvés, dans la limite des sommes
          effectivement versées par le Client au cours des 3 derniers mois précédant le fait générateur.
          WashBoard ne saurait être tenu responsable de pertes d&apos;exploitation, de chiffre d&apos;affaires ou de clientèle.
        </p>
      </Section>

      <Section title="11. Modifications des CGV">
        <p>
          WashBoard se réserve le droit de modifier les présentes CGV à tout moment. Le Client sera informé par
          email au moins 30 jours avant l&apos;entrée en vigueur des nouvelles conditions. La poursuite de l&apos;utilisation
          du service après cette date vaut acceptation des nouvelles CGV.
        </p>
      </Section>

      <Section title="12. Droit applicable et litiges">
        <p>
          Les présentes CGV sont soumises au droit français. En cas de litige, les parties s&apos;engagent à rechercher
          une solution amiable avant tout recours judiciaire. À défaut d&apos;accord, les tribunaux du ressort du siège
          social de WashBoard seront seuls compétents.
        </p>
      </Section>
    </article>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      <div className="lg-corps">{children}</div>
    </section>
  )
}

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mentions légales — WashBoard',
  robots: { index: false },
}

export default function MentionsLegales() {
  return (
    <article className="lg">
      <h1>Mentions légales</h1>
      <p className="lg-maj">Dernière mise à jour : octobre 2026</p>

      <Section title="1. Éditeur du site">
        <p>Le site <strong>washboard.fr</strong> est édité par :</p>
        <ul>
          <li><strong>Dénomination :</strong> NovaFlows</li>
          <li><strong>Forme juridique :</strong> société par actions simplifiée (SAS)</li>
          <li><strong>Activité :</strong> conception et édition de logiciels en ligne (SaaS)</li>
          <li><strong>Capital social :</strong> <Placeholder>MONTANT</Placeholder> €</li>
          <li><strong>Siège social :</strong> <Placeholder>ADRESSE DU SIÈGE</Placeholder></li>
          <li><strong>Immatriculation :</strong> RCS <Placeholder>VILLE</Placeholder> <Placeholder>SIREN</Placeholder></li>
          <li><strong>N° de TVA intracommunautaire :</strong> <Placeholder>FR…</Placeholder></li>
          <li><strong>Email :</strong> novaflows.pro@gmail.com</li>
        </ul>
        <p><strong>Directeur de la publication :</strong> Alexandre Bouharira-Thelliez</p>
      </Section>

      <Section title="2. Hébergement">
        <p>Le site est hébergé par :</p>
        <ul>
          <li><strong>Vercel Inc.</strong></li>
          <li>340 Pine Street, Suite 701 — San Francisco, CA 94104, États-Unis</li>
          <li>Site : <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">vercel.com</a></li>
        </ul>
        <p>
          Les données sont stockées via <strong>Supabase Inc.</strong> (infrastructure PostgreSQL) sur des serveurs
          situés dans l&apos;Union Européenne.
        </p>
      </Section>

      <Section title="3. Propriété intellectuelle">
        <p>
          L&apos;ensemble des éléments constituant le site washboard.fr (textes, graphismes, logiciels, marques, logos)
          est la propriété exclusive de l&apos;éditeur ou fait l&apos;objet d&apos;autorisations d&apos;utilisation.
          Toute reproduction, représentation, modification ou exploitation, totale ou partielle, sans autorisation
          écrite préalable est interdite et constitue une contrefaçon sanctionnée par les articles L.335-2 et suivants
          du Code de la Propriété Intellectuelle.
        </p>
      </Section>

      <Section title="4. Limitation de responsabilité">
        <p>
          L&apos;éditeur s&apos;efforce d&apos;assurer l&apos;exactitude et la mise à jour des informations diffusées
          sur ce site. Toutefois, il ne peut garantir l&apos;exactitude, la précision ou l&apos;exhaustivité des
          informations mises à disposition. L&apos;éditeur décline toute responsabilité pour toute imprécision,
          inexactitude ou omission portant sur des informations disponibles sur le site.
        </p>
      </Section>

      <Section title="5. Données personnelles">
        <p>
          Les données personnelles collectées via washboard.fr sont traitées conformément à notre{' '}
          <a href="/confidentialite">Politique de confidentialité</a>.
        </p>
      </Section>

      <Section title="6. Droit applicable">
        <p>
          Les présentes mentions légales sont soumises au droit français. En cas de litige, les tribunaux français
          seront seuls compétents.
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

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <span className="lg-ph">
      [{children}]
    </span>
  )
}

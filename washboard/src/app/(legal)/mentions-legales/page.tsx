import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mentions légales — WashBoard',
  robots: { index: false },
}

export default function MentionsLegales() {
  return (
    <article className="prose prose-slate dark:prose-invert max-w-none">
      <h1 className="text-3xl font-extrabold tracking-tight mb-2">Mentions légales</h1>
      <p className="text-sm text-slate-400 mb-10">Dernière mise à jour : juillet 2026</p>

      <Section title="1. Éditeur du site">
        <p>Le site <strong>washboard.fr</strong> est édité par :</p>
        <ul>
          <li><strong>Dénomination :</strong> <Placeholder>NOM LÉGAL / RAISON SOCIALE</Placeholder></li>
          <li><strong>Forme juridique :</strong> <Placeholder>FORME JURIDIQUE</Placeholder></li>
          <li><strong>SIRET :</strong> <Placeholder>SIRET</Placeholder></li>
          <li><strong>Adresse :</strong> <Placeholder>ADRESSE COMPLÈTE</Placeholder></li>
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
        <p>Les données sont stockées via <strong>Supabase Inc.</strong> (infrastructure PostgreSQL) sur des serveurs situés dans l'Union Européenne.</p>
      </Section>

      <Section title="3. Propriété intellectuelle">
        <p>
          L'ensemble des éléments constituant le site washboard.fr (textes, graphismes, logiciels, marques, logos) est la propriété
          exclusive de l'éditeur ou fait l'objet d'autorisations d'utilisation. Toute reproduction, représentation, modification
          ou exploitation, totale ou partielle, sans autorisation écrite préalable est interdite et constitue une contrefaçon
          sanctionnée par les articles L.335-2 et suivants du Code de la Propriété Intellectuelle.
        </p>
      </Section>

      <Section title="4. Limitation de responsabilité">
        <p>
          L'éditeur s'efforce d'assurer l'exactitude et la mise à jour des informations diffusées sur ce site. Toutefois, il ne
          peut garantir l'exactitude, la précision ou l'exhaustivité des informations mises à disposition. L'éditeur décline
          toute responsabilité pour toute imprécision, inexactitude ou omission portant sur des informations disponibles sur le site.
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
          Les présentes mentions légales sont soumises au droit français. En cas de litige, les tribunaux français seront seuls compétents.
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

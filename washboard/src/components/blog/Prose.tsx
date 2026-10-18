import Link from 'next/link'
import { THEME_LABEL, type Article } from '@/lib/blog'
import FilAriane from '@/components/landing/vitrine/FilAriane'

// Primitives de mise en forme partagées par tous les articles (refonte 2026 : mêmes jetons que
// la landing). Les classes `pr-*` vivent dans landing/vitrine/pages.css, importé par la coque
// (Coque.tsx) qui enveloppe le blog. Le plugin Tailwind `typography` n'est pas installé : la mise
// en forme est donc explicite, une seule fois, plutôt que recopiée dans chaque article.

export function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="pr-h2">{children}</h2>
}

export function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="pr-h3">{children}</h3>
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="pr-p">{children}</p>
}

export function UL({ children }: { children: React.ReactNode }) {
  return <ul className="pr-ul">{children}</ul>
}

/** Lien interne dans le corps du texte — le maillage contextuel pèse plus que les listes de fin d'article. */
export function A({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="pr-a">{children}</Link>
}

export function Callout({ children }: { children: React.ReactNode }) {
  return <aside className="pr-note">{children}</aside>
}

/**
 * Résumé en tête d'article. Trois à cinq phrases courtes qui répondent
 * directement à la question du titre : c'est ce que Google reprend en extrait
 * et ce que les assistants IA citent quand ils recommandent une page.
 */
export function Summary({ items }: { items: string[] }) {
  return (
    <aside aria-label="En bref" className="pr-bref">
      <p className="sur-titre"><span className="pt" />En bref</p>
      <ul>
        {items.map(item => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </aside>
  )
}

/** Tableau simple — défile horizontalement sur mobile plutôt que d'élargir la page. */
export function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    // tabIndex : une zone qui défile doit être atteignable au clavier.
    <div className="pr-tab" tabIndex={0} role="region" aria-label="Tableau de données">
      <table>
        <thead>
          <tr>
            {head.map(h => <th key={h} scope="col">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => <td key={j}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Fil d'Ariane visible — doublé en JSON-LD par ArticleJsonLd pour Google. */
export function Breadcrumb({ current }: { current: string }) {
  return (
    <FilAriane items={[{ label: 'Accueil', href: '/' }, { label: 'Blog', href: '/blog' }, { label: current }]} />
  )
}

export function ArticleHeader({ article, intro }: { article: Article; intro: string }) {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const updated = article.updatedAt !== article.publishedAt
  return (
    <header className="pr-tete">
      <Breadcrumb current={article.title} />
      <p className="pr-meta">
        {updated ? (
          <>
            Mis à jour le <time dateTime={article.updatedAt}>{fmt(article.updatedAt)}</time>
          </>
        ) : (
          <time dateTime={article.publishedAt}>{fmt(article.publishedAt)}</time>
        )}
        {' · '}{article.readingMinutes} min de lecture
      </p>
      <h1 className="pr-h1">{article.title}</h1>
      <p className="pr-intro">{intro}</p>
    </header>
  )
}

export type FaqItem = { question: string; answer: string }

/**
 * Questions fréquentes en fin d'article. Les réponses sont du texte brut
 * (pas de JSX) pour pouvoir être reprises telles quelles dans le JSON-LD
 * FAQPage — c'est ce balisage qui permet à Google d'afficher les questions
 * directement dans les résultats.
 */
export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <section className="pr-faq">
      <H2>Questions fréquentes</H2>
      <div className="faq">
        {items.map(item => (
          <details key={item.question}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

/**
 * Encart de fin d'article. Le texte change selon l'angle abordé.
 *
 * `secondary` : lien sobre vers la page métier (ou la page catégorie) du
 * thème de l'article — à passer via `lienPageMetier` (`@/lib/metiers`), qui
 * donne l'adresse et le texte ensemble, jamais écrits à la main. Absent :
 * rien ne s'affiche.
 */
export function Cta({
  title,
  children,
  secondary,
}: {
  title: string
  children: React.ReactNode
  secondary?: { href: string; label: string }
}) {
  return (
    <div className="pr-cta">
      <h2>{title}</h2>
      <p>{children}</p>
      <div className="heros-cta">
        <Link href="/signup" className="btn btn-accent">Lancer mon mois gratuit</Link>
        {secondary && <Link href={secondary.href} className="pg-lien-doux">{secondary.label}</Link>}
      </div>
      <p className="rassure">Sans engagement · Sans carte bancaire</p>
    </div>
  )
}

/** Liens vers les autres articles — le maillage interne compte pour le référencement. */
export function AlsoRead({ items }: { items: { href: string; label: string }[] }) {
  return (
    <nav className="pr-lire" aria-label="À lire aussi">
      <p className="titre">À lire aussi</p>
      <ul>
        {items.map(item => (
          <li key={item.href}>
            <Link href={item.href} className="pr-a">{item.label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/**
 * Données structurées schema.org : Google comprend qu'il s'agit d'un article,
 * connaît sa place dans le site (fil d'Ariane) et, si l'article a une FAQ,
 * peut afficher les questions directement dans les résultats.
 */
export function ArticleJsonLd({
  article,
  siteUrl,
  faq,
}: {
  article: Article
  siteUrl: string
  faq?: FaqItem[]
}) {
  const url = `${siteUrl}/blog/${article.slug}`
  const graph: Record<string, unknown>[] = [
    {
      '@type': 'Article',
      '@id': `${url}#article`,
      headline: article.title,
      description: article.description,
      inLanguage: 'fr-FR',
      articleSection: THEME_LABEL[article.theme],
      datePublished: article.publishedAt,
      dateModified: article.updatedAt,
      image: `${url}/opengraph-image`,
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      author: { '@type': 'Organization', name: 'WashBoard', url: siteUrl },
      publisher: {
        '@type': 'Organization',
        name: 'WashBoard',
        url: siteUrl,
        logo: { '@type': 'ImageObject', url: `${siteUrl}/LogoWashBoard.png` },
      },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: `${siteUrl}/blog` },
        { '@type': 'ListItem', position: 3, name: article.title, item: url },
      ],
    },
  ]
  if (faq && faq.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: faq.map(item => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    })
  }
  const jsonLd = { '@context': 'https://schema.org', '@graph': graph }
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
  )
}

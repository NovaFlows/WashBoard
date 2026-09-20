import Link from 'next/link'
import type { Article } from '@/lib/blog'

// Primitives de mise en forme partagées par tous les articles.
// Le plugin Tailwind `typography` n'est pas installé : les classes `prose` ne
// produisent rien dans ce projet, la mise en forme est donc explicite ici —
// une seule fois, plutôt que recopiée dans chaque article.

export function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-2xl font-black tracking-tight text-balance mt-12 mb-4 scroll-mt-20">
      {children}
    </h2>
  )
}

export function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-lg font-bold tracking-tight text-balance mt-8 mb-3 scroll-mt-20">
      {children}
    </h3>
  )
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="text-slate-700 dark:text-slate-300 leading-[1.75] mb-4">{children}</p>
}

export function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul className="list-disc pl-5 space-y-2 mb-5 text-slate-700 dark:text-slate-300 leading-[1.7] marker:text-slate-400 dark:marker:text-slate-600">
      {children}
    </ul>
  )
}

/** Lien interne dans le corps du texte — le maillage contextuel pèse plus que les listes de fin d'article. */
export function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-[#1651E8] dark:text-[#6A9FFF] hover:underline">
      {children}
    </Link>
  )
}

export function Callout({ children }: { children: React.ReactNode }) {
  return (
    <aside className="my-7 p-5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <div className="text-[0.95rem] text-slate-700 dark:text-slate-300 leading-[1.7] [&>p:last-child]:mb-0">
        {children}
      </div>
    </aside>
  )
}

/**
 * Résumé en tête d'article. Trois à cinq phrases courtes qui répondent
 * directement à la question du titre : c'est ce que Google reprend en extrait
 * et ce que les assistants IA citent quand ils recommandent une page.
 */
export function Summary({ items }: { items: string[] }) {
  return (
    <aside
      aria-label="En bref"
      className="mb-10 p-5 rounded-xl bg-[#1651E8]/[0.04] dark:bg-[#6A9FFF]/[0.06] border border-[#1651E8]/15 dark:border-[#6A9FFF]/15"
    >
      <p className="text-xs font-black text-[#1651E8] dark:text-[#6A9FFF] uppercase tracking-[0.18em] mb-3">
        En bref
      </p>
      <ul className="space-y-2 text-[0.95rem] text-slate-700 dark:text-slate-300 leading-[1.6] list-disc pl-5 marker:text-[#1651E8]/50 dark:marker:text-[#6A9FFF]/50">
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
    <div className="my-7 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-900">
            {head.map(h => (
              <th key={h} className="text-left font-bold px-4 py-3 whitespace-nowrap border-b border-slate-200 dark:border-slate-800">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i > 0 ? 'border-t border-slate-100 dark:border-slate-800/60' : ''}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`px-4 py-3 align-top text-slate-700 dark:text-slate-300 ${j > 0 ? 'tabular-nums whitespace-nowrap' : ''}`}
                >
                  {cell}
                </td>
              ))}
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
    <nav aria-label="Fil d'Ariane" className="mb-6 text-xs text-slate-400 dark:text-slate-500">
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link href="/" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">Accueil</Link>
        </li>
        <li aria-hidden="true">/</li>
        <li>
          <Link href="/blog" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">Blog</Link>
        </li>
        <li aria-hidden="true">/</li>
        <li className="text-slate-500 dark:text-slate-400 truncate max-w-[60vw] sm:max-w-none" aria-current="page">
          {current}
        </li>
      </ol>
    </nav>
  )
}

export function ArticleHeader({ article, intro }: { article: Article; intro: string }) {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const updated = article.updatedAt !== article.publishedAt
  return (
    <header className="mb-10 pb-8 border-b border-slate-200 dark:border-slate-800">
      <Breadcrumb current={article.title} />
      <p className="text-xs text-slate-400 dark:text-slate-500 mb-3 tabular-nums">
        {updated ? (
          <>
            Mis à jour le <time dateTime={article.updatedAt}>{fmt(article.updatedAt)}</time>
          </>
        ) : (
          <time dateTime={article.publishedAt}>{fmt(article.publishedAt)}</time>
        )}
        {' · '}{article.readingMinutes} min de lecture
      </p>
      <h1 className="text-3xl sm:text-[2.6rem] font-black tracking-tight leading-[1.1] text-balance mb-4">
        {article.title}
      </h1>
      <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">{intro}</p>
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
    <section className="mt-12">
      <H2>Questions fréquentes</H2>
      <div className="divide-y divide-slate-200 dark:divide-slate-800 border-y border-slate-200 dark:border-slate-800">
        {items.map(item => (
          <details key={item.question} className="group py-4">
            <summary className="flex items-start justify-between gap-4 cursor-pointer list-none font-semibold text-slate-900 dark:text-slate-100 [&::-webkit-details-marker]:hidden">
              <span>{item.question}</span>
              <span aria-hidden="true" className="shrink-0 mt-0.5 text-slate-400 transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-slate-700 dark:text-slate-300 leading-[1.7]">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

/** Encart de fin d'article. Le texte change selon l'angle abordé. */
export function Cta({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-12 p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <h2 className="text-xl font-black tracking-tight mb-2">{title}</h2>
      <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-5">{children}</p>
      <Link
        href="/signup"
        className="inline-block px-5 py-3 bg-[#1651E8] hover:bg-[#0F4ACC] text-white text-sm font-semibold rounded-xl transition-colors"
      >
        Lancer mon mois gratuit
      </Link>
      <p className="text-xs text-slate-400 mt-3">Sans engagement · Sans carte bancaire</p>
    </div>
  )
}

/** Liens vers les autres articles — le maillage interne compte pour le référencement. */
export function AlsoRead({ items }: { items: { href: string; label: string }[] }) {
  return (
    <nav className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800">
      <p className="text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.18em] mb-4">
        À lire aussi
      </p>
      <ul className="space-y-3">
        {items.map(item => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="font-semibold text-[#1651E8] dark:text-[#6A9FFF] hover:underline leading-snug"
            >
              {item.label}
            </Link>
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

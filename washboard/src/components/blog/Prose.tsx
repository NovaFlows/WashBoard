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

export function Callout({ children }: { children: React.ReactNode }) {
  return (
    <aside className="my-7 p-5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <div className="text-[0.95rem] text-slate-700 dark:text-slate-300 leading-[1.7] [&>p:last-child]:mb-0">
        {children}
      </div>
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

export function ArticleHeader({ article, intro }: { article: Article; intro: string }) {
  const date = new Date(article.publishedAt).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  return (
    <header className="mb-10 pb-8 border-b border-slate-200 dark:border-slate-800">
      <p className="text-xs text-slate-400 dark:text-slate-500 mb-3 tabular-nums">
        <time dateTime={article.publishedAt}>{date}</time>
        {' · '}{article.readingMinutes} min de lecture
      </p>
      <h1 className="text-3xl sm:text-[2.6rem] font-black tracking-tight leading-[1.1] text-balance mb-4">
        {article.title}
      </h1>
      <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">{intro}</p>
    </header>
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

/** Données structurées schema.org : Google comprend qu'il s'agit d'un article. */
export function ArticleJsonLd({ article, siteUrl }: { article: Article; siteUrl: string }) {
  const url = `${siteUrl}/blog/${article.slug}`
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author: { '@type': 'Organization', name: 'WashBoard', url: siteUrl },
    publisher: {
      '@type': 'Organization',
      name: 'WashBoard',
      url: siteUrl,
      logo: { '@type': 'ImageObject', url: `${siteUrl}/LogoWashBoard.png` },
    },
  }
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { ARTICLES, SITE_URL } from '@/lib/blog'

const title = 'Le blog — conseils pour laveurs auto mobiles | WashBoard'
const description =
  'Conseils concrets pour développer une activité de lavage auto à domicile : trouver des clients, fixer ses tarifs, organiser ses tournées, se lancer dans les règles.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/blog`,
    title,
    description,
  },
  twitter: { card: 'summary_large_image', title, description },
}

// Google voit la liste comme un blog avec ses articles, pas comme une page
// quelconque — et connaît la place de la page dans le site.
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Blog',
      '@id': `${SITE_URL}/blog#blog`,
      name: 'Le blog WashBoard',
      description,
      url: `${SITE_URL}/blog`,
      inLanguage: 'fr-FR',
      publisher: { '@type': 'Organization', name: 'WashBoard', url: SITE_URL },
      blogPost: ARTICLES.map(a => ({
        '@type': 'BlogPosting',
        headline: a.title,
        description: a.description,
        url: `${SITE_URL}/blog/${a.slug}`,
        datePublished: a.publishedAt,
        dateModified: a.updatedAt,
      })),
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
      ],
    },
  ],
}

export default function BlogIndex() {
  // Les plus récemment mis à jour en premier : un article retravaillé remonte.
  const articles = [...ARTICLES].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="mb-12">
        <p className="text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em] mb-3">
          Le blog
        </p>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-balance mb-3">
          Conseils pour laveurs auto mobiles
        </h1>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
          Ce qu&apos;on apprend en travaillant avec des laveurs auto à domicile : trouver des
          clients, fixer ses prix, organiser ses journées, arrêter de perdre du temps sur
          l&apos;administratif.
        </p>
      </header>

      <ul className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
        {articles.map(article => (
          <li key={article.slug}>
            <Link
              href={`/blog/${article.slug}`}
              className="group block py-7 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1651E8] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 rounded-lg"
            >
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-2 tabular-nums">
                <time dateTime={article.updatedAt}>
                  {new Date(article.updatedAt).toLocaleDateString('fr-FR', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </time>
                {' · '}{article.readingMinutes} min de lecture
              </p>
              <h2 className="text-xl font-bold tracking-tight text-balance mb-2 group-hover:text-[#1651E8] dark:group-hover:text-[#6A9FFF] transition-colors">
                {article.title}
              </h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                {article.description}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}

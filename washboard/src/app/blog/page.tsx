import type { Metadata } from 'next'
import Link from 'next/link'
import { ARTICLES, SITE_URL, THEME_LABEL, type Article, type Theme } from '@/lib/blog'

const title = 'Le blog — conseils pour les pros du nettoyage à domicile | WashBoard'
const description =
  'Conseils concrets pour développer une activité de nettoyage à domicile — lavage auto, vitres, canapés, ménage, piscines, terrasses : trouver des clients, fixer ses tarifs, organiser ses tournées, se lancer dans les règles.'

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
        articleSection: THEME_LABEL[a.theme],
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

// Ordre d'affichage des métiers : le lavage auto d'abord (le plus d'articles,
// le premier public de WashBoard), puis les autres, les conseils communs à la fin.
const THEME_ORDER: Theme[] = ['auto', 'vitres', 'textiles', 'menage', 'piscine', 'exterieur', 'general']

function ArticleRow({ article }: { article: Article }) {
  return (
    <li>
      <Link
        href={`/blog/${article.slug}`}
        className="group block py-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1651E8] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 rounded-lg"
      >
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-2 tabular-nums">
          <time dateTime={article.updatedAt}>
            {new Date(article.updatedAt).toLocaleDateString('fr-FR', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          </time>
          {' · '}{article.readingMinutes} min de lecture
        </p>
        <h3 className="text-xl font-bold tracking-tight text-balance mb-2 group-hover:text-[#1651E8] dark:group-hover:text-[#6A9FFF] transition-colors">
          {article.title}
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
          {article.description}
        </p>
      </Link>
    </li>
  )
}

export default function BlogIndex() {
  // Regroupés par métier, les plus récemment mis à jour en premier dans chaque groupe.
  const groups = THEME_ORDER
    .map(theme => ({
      theme,
      articles: ARTICLES
        .filter(a => a.theme === theme)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    }))
    .filter(g => g.articles.length > 0)

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="mb-10">
        <p className="text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em] mb-3">
          Le blog
        </p>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-balance mb-3">
          Conseils pour les pros du nettoyage à domicile
        </h1>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
          Ce qu&apos;on apprend en travaillant avec des laveurs auto, laveurs de vitres,
          nettoyeurs de canapés, femmes et hommes de ménage, pisciniers : trouver des clients,
          fixer ses prix, organiser ses journées, arrêter de perdre du temps sur
          l&apos;administratif.
        </p>
        {/* Accès direct à chaque métier : sur mobile, la liste complète est longue. */}
        <nav aria-label="Métiers" className="mt-6 flex flex-wrap gap-2">
          {groups.map(g => (
            <a
              key={g.theme}
              href={`#${g.theme}`}
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-[#1651E8]/10 hover:text-[#1651E8] dark:hover:text-[#6A9FFF] transition-colors"
            >
              {THEME_LABEL[g.theme]}
            </a>
          ))}
        </nav>
      </header>

      {groups.map(g => (
        <section key={g.theme} id={g.theme} className="mb-12 scroll-mt-20">
          <h2 className="text-xs font-black text-[#1651E8] dark:text-[#6A9FFF] uppercase tracking-[0.18em] pb-3 border-b border-slate-200 dark:border-slate-800">
            {THEME_LABEL[g.theme]}
          </h2>
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {g.articles.map(article => (
              <ArticleRow key={article.slug} article={article} />
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}

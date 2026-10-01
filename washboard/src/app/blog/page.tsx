import type { Metadata } from 'next'
import Link from 'next/link'
import { ARTICLES, SITE_URL, THEME_LABEL, type Article, type Theme } from '@/lib/blog'

// Titre mesuré au pixel (canvas 2D, police Arial 20px — celle que Google
// utilise pour le titre du résultat sur desktop) : 394px, sous la limite de
// troncature généralement admise autour de 600px.
//
// Recentrage 2026-09 (voir layout.tsx pour la même décision sur l'accueil) :
// le blog listait 6 métiers à égalité alors que le reste du site s'est
// resserré sur le lavage auto & detailing. Le titre et l'intro suivent
// maintenant le même ordre — auto d'abord — sans lister chaque métier.
const title = 'Le blog lavage auto & detailing | WashBoard'
const description =
  'Conseils concrets pour développer une activité de lavage auto & detailing à domicile, et de nettoyage de canapés et textiles : trouver des clients, fixer ses tarifs, organiser ses tournées, se lancer dans les règles. D’autres métiers mobiles (vitres, ménage, piscines, extérieur) y sont aussi couverts.'

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

// Deux niveaux, pas six thèmes à égalité (recentrage 2026-09, voir plus haut) :
// - piliers, chacun sa section titrée et sa pastille de filtre — l'auto
//   d'abord (premier public de WashBoard), puis les canapés & textiles, seul
//   autre métier mis en avant ailleurs sur le site (landing, footer).
// - le reste (vitres, ménage, piscine, extérieur) reste consultable mais
//   rejoint une unique rubrique secondaire : disponible pour qui le cherche,
//   sans prétendre être un pilier du blog. `general` (conseils valables pour
//   tous les métiers, sans lien particulier avec l'auto) rejoint ce même
//   groupe plutôt que de former une troisième catégorie — aucun article n'y
//   est rattaché aujourd'hui, mais le regroupement tient si ça change.
const PRIMARY_THEMES: Theme[] = ['auto', 'textiles']
const SECONDARY_THEMES: Theme[] = ['vitres', 'menage', 'piscine', 'exterieur', 'general']
const SECONDARY_ID = 'autres-metiers'
const SECONDARY_LABEL = 'Autres métiers mobiles'

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
  // Piliers : chacun sa section, les plus récemment mis à jour en premier.
  const primaryGroups = PRIMARY_THEMES
    .map(theme => ({
      theme,
      label: THEME_LABEL[theme],
      articles: ARTICLES
        .filter(a => a.theme === theme)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    }))
    .filter(g => g.articles.length > 0)

  // Reste des métiers : une seule liste, tous mélangés par date de mise à
  // jour — pas de sous-section par métier (voir commentaire plus haut).
  const secondaryArticles = ARTICLES
    .filter(a => SECONDARY_THEMES.includes(a.theme))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  const navItems = [
    ...primaryGroups.map(g => ({ id: g.theme, label: g.label })),
    ...(secondaryArticles.length > 0 ? [{ id: SECONDARY_ID, label: SECONDARY_LABEL }] : []),
  ]

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="mb-10">
        <p className="text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em] mb-3">
          Le blog
        </p>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-balance mb-3">
          Lavage auto & detailing : les conseils du blog
        </h1>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
          Ce que WashBoard apprend en travaillant avec des laveurs auto, des pros du detailing et du nettoyage de canapés et textiles à domicile : trouver des clients, fixer ses tarifs, organiser ses tournées, arrêter de perdre du temps sur l&apos;administratif. D&apos;autres métiers mobiles (vitres, ménage, piscines, extérieur) restent couverts, réunis plus bas dans une dernière rubrique.
        </p>
        {/* Accès direct à chaque pilier : sur mobile, la liste complète est longue. */}
        <nav aria-label="Métiers" className="mt-6 flex flex-wrap gap-2">
          {navItems.map(item => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-[#1651E8]/10 hover:text-[#1651E8] dark:hover:text-[#6A9FFF] transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </header>

      {primaryGroups.map(g => (
        <section key={g.theme} id={g.theme} className="mb-12 scroll-mt-20">
          <h2 className="text-xs font-black text-[#1651E8] dark:text-[#6A9FFF] uppercase tracking-[0.18em] pb-3 border-b border-slate-200 dark:border-slate-800">
            {g.label}
          </h2>
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {g.articles.map(article => (
              <ArticleRow key={article.slug} article={article} />
            ))}
          </ul>
        </section>
      ))}

      {secondaryArticles.length > 0 && (
        <section id={SECONDARY_ID} className="mb-12 scroll-mt-20">
          <h2 className="text-xs font-black text-[#1651E8] dark:text-[#6A9FFF] uppercase tracking-[0.18em] pb-3 border-b border-slate-200 dark:border-slate-800">
            {SECONDARY_LABEL}
          </h2>
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {secondaryArticles.map(article => (
              <ArticleRow key={article.slug} article={article} />
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

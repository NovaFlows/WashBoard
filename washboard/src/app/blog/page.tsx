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
      <Link href={`/blog/${article.slug}`}>
        <p className="meta">
          <time dateTime={article.updatedAt}>
            {new Date(article.updatedAt).toLocaleDateString('fr-FR', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          </time>
          {' · '}{article.readingMinutes} min de lecture
        </p>
        <h3>{article.title}</h3>
        <p className="desc">{article.description}</p>
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
      <header className="bl-tete">
        <p className="sur-titre"><span className="pt" />Le blog</p>
        <h1 className="pr-h1">
          Lavage auto & detailing : les conseils du blog
        </h1>
        <p className="chapo">
          Ce que WashBoard apprend en travaillant avec des laveurs auto, des pros du detailing et du nettoyage de canapés et textiles à domicile : trouver des clients, fixer ses tarifs, organiser ses tournées, arrêter de perdre du temps sur l&apos;administratif. D&apos;autres métiers mobiles (vitres, ménage, piscines, extérieur) restent couverts, réunis plus bas dans une dernière rubrique.
        </p>
        {/* Accès direct à chaque pilier : sur mobile, la liste complète est longue. */}
        <nav aria-label="Métiers" className="puces">
          {navItems.map(item => (
            <a key={item.id} href={`#${item.id}`}>{item.label}</a>
          ))}
        </nav>
      </header>

      {primaryGroups.map(g => (
        <section key={g.theme} id={g.theme} className="bl-rubrique">
          <h2>{g.label}</h2>
          <ul className="bl-liste">
            {g.articles.map(article => (
              <ArticleRow key={article.slug} article={article} />
            ))}
          </ul>
        </section>
      ))}

      {secondaryArticles.length > 0 && (
        <section id={SECONDARY_ID} className="bl-rubrique">
          <h2>{SECONDARY_LABEL}</h2>
          <ul className="bl-liste">
            {secondaryArticles.map(article => (
              <ArticleRow key={article.slug} article={article} />
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

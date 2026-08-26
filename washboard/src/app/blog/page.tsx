import type { Metadata } from 'next'
import Link from 'next/link'
import { ARTICLES, SITE_URL } from '@/lib/blog'

export const metadata: Metadata = {
  title: 'Le blog — conseils pour laveurs auto mobiles | WashBoard',
  description:
    'Conseils concrets pour développer une activité de lavage auto à domicile : trouver des clients, fixer ses tarifs, organiser ses tournées.',
  alternates: { canonical: `${SITE_URL}/blog` },
}

export default function BlogIndex() {
  return (
    <>
      <header className="mb-12">
        <p className="text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em] mb-3">
          Le blog
        </p>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-balance mb-3">
          Conseils pour laveurs auto mobiles
        </h1>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
          Ce qu&apos;on apprend en travaillant avec des laveurs auto à domicile : trouver des
          clients, organiser ses journées, arrêter de perdre du temps sur l&apos;administratif.
        </p>
      </header>

      <ul className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
        {ARTICLES.map(article => (
          <li key={article.slug}>
            <Link
              href={`/blog/${article.slug}`}
              className="group block py-7 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1651E8] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 rounded-lg"
            >
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-2 tabular-nums">
                <time dateTime={article.publishedAt}>
                  {new Date(article.publishedAt).toLocaleDateString('fr-FR', {
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

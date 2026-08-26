'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { searchGuide, type GuideEntry } from '@/lib/guide'

/**
 * Rend une réponse du guide en transformant les liens [libellé](/chemin)
 * en liens bleus vers la page concernée. C'est ce qui permet d'écrire le
 * contenu en texte simple tout en gardant une navigation interne.
 */
function Answer({ text }: { text: string }) {
  const parts: React.ReactNode[] = []
  const re = /\[([^\]]+)\]\(([^)]+)\)/g
  let last = 0
  let m: RegExpExecArray | null

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    parts.push(
      <Link
        key={`${m.index}-${m[2]}`}
        href={m[2]}
        className="font-semibold text-[#1651E8] dark:text-[#6A9FFF] hover:underline"
      >
        {m[1]}
      </Link>,
    )
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))

  return <p className="text-sm text-slate-600 dark:text-slate-400 leading-[1.7]">{parts}</p>
}

function EntryCard({ entry }: { entry: GuideEntry }) {
  return (
    <div className="py-4 border-b border-slate-100 dark:border-slate-800/70 last:border-0">
      <h3 className="font-bold text-slate-900 dark:text-white mb-1.5">{entry.question}</h3>
      <Answer text={entry.answer} />
    </div>
  )
}

/**
 * @param intro  Contenu affiche entre la recherche et les sections (la video
 *               tuto). Masque des qu une recherche est active : on veut les
 *               reponses, pas un lecteur video a faire defiler.
 */
export default function GuideContent({ intro }: { intro?: React.ReactNode }) {
  const [query, setQuery] = useState('')

  const sections = useMemo(() => searchGuide(query), [query])

  const total = sections.reduce((n, s) => n + s.entries.length, 0)

  return (
    <>
      <div className="relative mb-8">
        <svg
          aria-hidden
          className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher — congés, tarifs, avis Google…"
          aria-label="Rechercher dans le guide"
          className="w-full pl-11 pr-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1651E8] focus:border-transparent"
        />
      </div>

      {query.trim() && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5" aria-live="polite">
          {total === 0
            ? 'Aucun résultat.'
            : `${total} réponse${total > 1 ? 's' : ''} pour « ${query.trim()} »`}
        </p>
      )}

      {!query.trim() && intro}

      {total === 0 && query.trim() ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Rien trouvé pour cette recherche. Essayez un autre mot, ou écrivez-nous à{' '}
            <a href="mailto:novaflows.pro@gmail.com" className="font-semibold text-[#1651E8] dark:text-[#6A9FFF] hover:underline">
              novaflows.pro@gmail.com
            </a>.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {sections.map(section => (
            <section key={section.id} aria-labelledby={`guide-${section.id}`}>
              <div className="mb-2">
                <h2 id={`guide-${section.id}`} className="text-lg font-black text-slate-900 dark:text-white">
                  {section.title}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{section.summary}</p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5">
                {section.entries.map(entry => (
                  <EntryCard key={entry.id} entry={entry} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  )
}

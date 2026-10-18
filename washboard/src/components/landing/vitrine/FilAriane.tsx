import { Fragment } from 'react'
import Link from 'next/link'

// Fil d'Ariane visible. Le dernier élément est la page courante (sans lien).
export default function FilAriane({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Fil d'Ariane" className="fil">
      <ol>
        {items.map((it, i) => (
          <Fragment key={it.label}>
            {i > 0 && <li aria-hidden="true">/</li>}
            <li {...(it.href ? {} : { 'aria-current': 'page' as const })}>
              {it.href ? <Link href={it.href}>{it.label}</Link> : it.label}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  )
}

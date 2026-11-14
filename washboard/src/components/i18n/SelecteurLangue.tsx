'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LANGUES, memoriserLangue, NOMS_LANGUES, type Langue } from '@/lib/i18n/langues'
import { useLangue, useT } from './I18nProvider'

// Le globe : choisir la langue. Le choix est gardé un an dans un cookie, puis la page est
// rechargée côté serveur pour s'afficher dans la nouvelle langue.
export default function SelecteurLangue({ direction = 'bas', className = '' }: { direction?: 'bas' | 'haut'; className?: string }) {
  const langue = useLangue()
  const t = useT()
  const router = useRouter()
  const [ouvert, setOuvert] = useState(false)
  const racine = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ouvert) return
    const dehors = (e: MouseEvent) => { if (!racine.current?.contains(e.target as Node)) setOuvert(false) }
    const echap = (e: KeyboardEvent) => { if (e.key === 'Escape') setOuvert(false) }
    document.addEventListener('mousedown', dehors)
    document.addEventListener('keydown', echap)
    return () => { document.removeEventListener('mousedown', dehors); document.removeEventListener('keydown', echap) }
  }, [ouvert])

  function choisir(l: Langue) {
    setOuvert(false)
    if (l === langue) return
    memoriserLangue(l)
    router.refresh()
  }

  return (
    <div ref={racine} className={`wb-langue ${className}`} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        className="wb-langue-btn"
        aria-label={t('Changer de langue')}
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        onClick={() => setOuvert(o => !o)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: 0, color: 'inherit', cursor: 'pointer', padding: '6px 8px', borderRadius: 8, font: 'inherit', minHeight: 36 }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.6-3.9-9S9.4 5.6 12 3z" />
        </svg>
        <span style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '.04em' }}>{langue}</span>
      </button>
      {ouvert && (
        <ul
          role="listbox"
          aria-label={t('Langue')}
          style={{
            position: 'absolute', right: 0, [direction === 'haut' ? 'bottom' : 'top']: 'calc(100% + 6px)', zIndex: 80,
            margin: 0, padding: 4, listStyle: 'none', minWidth: 150, borderRadius: 12,
            background: 'Canvas', color: 'CanvasText',
            border: '1px solid rgba(128,128,128,.28)', boxShadow: '0 10px 30px rgba(0,0,0,.18)',
          }}
        >
          {LANGUES.map(l => (
            <li key={l} role="option" aria-selected={l === langue}>
              <button
                type="button"
                lang={l}
                onClick={() => choisir(l)}
                style={{ width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', gap: 12, background: l === langue ? 'rgba(128,128,128,.16)' : 'transparent', border: 0, color: 'inherit', cursor: 'pointer', padding: '9px 12px', borderRadius: 8, font: 'inherit', fontSize: 14 }}
              >
                <span>{NOMS_LANGUES[l]}</span>{l === langue && <span aria-hidden="true">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { Feuille, corps, corpsFort } from '@/components/dashboard/FeuilleV2'
import { useLangue, useT } from '@/components/i18n/I18nProvider'
import { LANGUES, memoriserLangue, NOMS_LANGUES, type Langue } from '@/lib/i18n/langues'

// Choisir la langue de l'application : une feuille, comme les autres réglages, plutôt qu'une liste qui s'étend.
export default function FeuilleLangueV2({ onClose }: { onClose: () => void }) {
  const t = useT()
  const langue = useLangue()
  const router = useRouter()

  function choisir(l: Langue) {
    onClose()
    if (l === langue) return
    memoriserLangue(l)
    router.refresh()
  }

  return (
    <Feuille titre={t('Langue')} onClose={onClose}>
      <ul className="rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] px-4 divide-y divide-[color:var(--v2-filet)]" role="listbox" aria-label={t('Langue')}>
        {LANGUES.map(l => (
          <li key={l} role="option" aria-selected={l === langue}>
            <button type="button" lang={l} onClick={() => choisir(l)} className="flex min-h-12 w-full items-center justify-between gap-3 py-3 text-left">
              <span className={`text-[15.5px] ${l === langue ? corpsFort : corps}`}>{NOMS_LANGUES[l]}</span>
              {l === langue ? <Check size={18} strokeWidth={2.2} aria-hidden style={{ color: 'var(--v2-color-accent)' }} /> : null}
            </button>
          </li>
        ))}
      </ul>
    </Feuille>
  )
}

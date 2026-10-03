'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { BookingPageMode } from '@/lib/bookingPageMode'

/** Commun au site et à la PWA. Le choix visible change après confirmation du serveur. */
export default function BookingPageModePicker({ mode, onChange }: {
  mode: BookingPageMode
  onChange: (mode: BookingPageMode) => void
}) {
  const router = useRouter()
  const [pending, setPending] = useState<BookingPageMode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const busy = useRef(false)

  async function choose(next: BookingPageMode) {
    if (busy.current || next === mode) return
    busy.current = true
    setPending(next)
    setError(null)
    setSaved(false)
    try {
      const response = await fetch('/api/washer', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ booking_page_mode: next }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Impossible de changer de page. Réessayez.')
      onChange(next)
      setSaved(true)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de changer de page. Réessayez.')
    } finally {
      busy.current = false
      setPending(null)
    }
  }

  return <section aria-labelledby="booking-page-mode-title" className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
    <h2 id="booking-page-mode-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">Votre page de réservation</h2>
    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">Choisissez la présentation que vos clients voient en ouvrant votre lien.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      {([
        { value: 'default', title: 'Page par défaut', description: 'Prête à l’emploi : trois étapes sur une même page, avec le prix et le bouton toujours accessibles.' },
        { value: 'custom', title: 'Faire ma propre page', description: 'Retrouvez la présentation classique et ses réglages de logo, couleurs et fond, selon votre offre.' },
      ] as const).map(option => <button key={option.value} type="button" aria-pressed={mode === option.value} disabled={pending !== null}
        onClick={() => choose(option.value)} className={'text-left rounded-xl border-2 p-4 touch-manipulation disabled:cursor-wait ' + (mode === option.value ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/30' : 'border-slate-200 dark:border-slate-700')}>
        <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{option.title}</span>
        <span className="block text-xs leading-relaxed text-slate-500 dark:text-slate-400 mt-2">{option.description}</span>
        <span className="block mt-3 text-xs font-semibold text-blue-700 dark:text-blue-400">{pending === option.value ? 'Enregistrement…' : mode === option.value ? 'Page active ✓' : 'Utiliser cette page'}</span>
      </button>)}
    </div>
    <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">Vous pouvez changer d’avis à tout moment. Vos réglages personnalisés sont conservés.</p>
    {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400 mt-3">{error}</p>}
    {saved && <p role="status" className="text-xs text-emerald-700 dark:text-emerald-400 mt-3">Le choix de votre page est enregistré.</p>}
  </section>
}

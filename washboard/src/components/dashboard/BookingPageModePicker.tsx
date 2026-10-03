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
    <label className="flex min-h-11 items-center gap-3 mt-3 cursor-pointer touch-manipulation">
      <input type="checkbox" checked={mode === 'default'} disabled={pending !== null}
        onChange={e => choose(e.target.checked ? 'default' : 'custom')}
        aria-describedby="booking-page-mode-description"
        className="h-5 w-5 shrink-0 accent-blue-600 disabled:cursor-wait" />
      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Page par défaut</span>
    </label>
    <p id="booking-page-mode-description" className="text-sm text-slate-500 dark:text-slate-400 mt-1">
      {mode === 'default' ? 'Décochez pour utiliser votre page personnalisée et ouvrir ses réglages.' : 'Page personnalisée active. Retrouvez vos réglages ci-dessous.'}
    </p>
    {pending !== null && <p role="status" className="text-xs text-slate-500 mt-3">Enregistrement…</p>}
    {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400 mt-3">{error}</p>}
    {saved && <p role="status" className="text-xs text-emerald-700 dark:text-emerald-400 mt-3">Le choix de votre page est enregistré.</p>}
  </section>
}

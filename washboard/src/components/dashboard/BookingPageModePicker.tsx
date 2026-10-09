'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { BookingPageMode } from '@/lib/bookingPageMode'
import { Interrupteur } from '@/components/dashboard/PrestationsUiV2'
import { corps, titre } from '@/components/dashboard/FeuilleV2'

/** Commun au site et à la PWA. Le choix visible change après confirmation du serveur.
 *  `v2` : même logique, habillée aux jetons de la refonte (`ApparenceV2`) — sans ça, le bleu
 *  vif et les gris du site détonnent dans la v2, surtout en sombre. */
export default function BookingPageModePicker({ mode, onChange, v2 = false }: {
  mode: BookingPageMode
  onChange: (mode: BookingPageMode) => void
  v2?: boolean
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

  const actif = mode === 'default'
  const description = mode === 'default' ? 'Décochez pour utiliser votre page personnalisée et ouvrir ses réglages.' : 'Page personnalisée active. Retrouvez vos réglages ci-dessous.'

  if (v2) {
    return <section aria-labelledby="booking-page-mode-title" className="rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] px-4 py-3.5">
      <h2 id="booking-page-mode-title" className={`text-[15px] ${titre} text-[color:var(--v2-color-encre)]`}>Votre page de réservation</h2>
      <div className="mt-1 flex items-center justify-between gap-3">
        <span className={`text-[14.5px] ${corps} text-[color:var(--v2-color-encre)]`}>Page par défaut</span>
        <Interrupteur actif={actif} enCours={pending !== null} libelle="Page par défaut" onClick={() => choose(actif ? 'custom' : 'default')} />
      </div>
      <p id="booking-page-mode-description" className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>{description}</p>
      {pending !== null && <p role="status" className={`mt-2 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Enregistrement…</p>}
      {error && <p role="alert" className={`mt-2 text-[13px] ${corps} text-[color:var(--v2-color-rouge)]`}>{error}</p>}
      {saved && <p role="status" className={`mt-2 text-[12.5px] ${corps} text-[color:var(--v2-color-vert)]`}>Le choix de votre page est enregistré.</p>}
    </section>
  }

  return <section aria-labelledby="booking-page-mode-title" className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
    <h2 id="booking-page-mode-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">Votre page de réservation</h2>
    <div className="flex items-center justify-between gap-3 mt-3 min-h-11">
      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Page par défaut</span>
      <button
        type="button"
        role="switch"
        aria-checked={actif}
        aria-label="Page par défaut"
        aria-describedby="booking-page-mode-description"
        disabled={pending !== null}
        onClick={() => choose(actif ? 'custom' : 'default')}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-wait disabled:opacity-50 ${actif ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${actif ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
    <p id="booking-page-mode-description" className="text-sm text-slate-500 dark:text-slate-400 mt-1">
      {description}
    </p>
    {pending !== null && <p role="status" className="text-xs text-slate-500 mt-3">Enregistrement…</p>}
    {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400 mt-3">{error}</p>}
    {saved && <p role="status" className="text-xs text-emerald-700 dark:text-emerald-400 mt-3">Le choix de votre page est enregistré.</p>}
  </section>
}

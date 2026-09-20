'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Settings } from 'lucide-react'
import { WIDGETS, type WidgetKey } from '@/lib/dashboardWidgets'

// Bouton « Configurer » de l'accueil : afficher ou masquer chacun des
// widgets, sans réorganisation — l'ordre reste toujours celui de WIDGETS.
//
// Le réglage est écrit en base (washers.dashboard_widgets) et non en
// localStorage : il doit rester le même d'un appareil à l'autre, ordinateur
// le jour, téléphone le soir.
//
// À l'enregistrement, `router.refresh()` relance le composant serveur de la
// page : c'est LUI qui décide quelles données charger pour quels widgets. Un
// widget masqué n'est donc pas seulement caché en CSS, sa requête n'est plus
// jamais faite — dans le droit fil de ce qu'on a corrigé sur cette même page
// le 18/09 (ne pas charger ce qui ne sera pas montré).

export function WidgetsConfigurator({ visibles }: { visibles: WidgetKey[] }) {
  const router = useRouter()
  const [ouvert, setOuvert] = useState(false)
  const [selection, setSelection] = useState<Set<WidgetKey>>(() => new Set(visibles))
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const panneauRef = useRef<HTMLDivElement>(null)

  // Resynchronise la sélection affichée si la page a été rafraîchie ailleurs
  // (un autre onglet, par exemple) pendant que le panneau était fermé.
  useEffect(() => {
    if (!ouvert) setSelection(new Set(visibles))
  }, [visibles, ouvert])

  useEffect(() => {
    if (!ouvert) return
    panneauRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOuvert(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [ouvert])

  function basculer(cle: WidgetKey) {
    setSelection(prev => {
      const next = new Set(prev)
      if (next.has(cle)) next.delete(cle)
      else next.add(cle)
      return next
    })
  }

  async function enregistrer() {
    setEnregistrement(true)
    setErreur(null)
    try {
      const res = await fetch('/api/washer', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dashboard_widgets: [...selection] }),
      })
      if (!res.ok) {
        setErreur('Enregistrement impossible. Réessayez dans un instant.')
        return
      }
      setOuvert(false)
      router.refresh()
    } catch {
      setErreur('Enregistrement impossible. Vérifiez votre connexion.')
    } finally {
      setEnregistrement(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <Settings size={14} />
        Configurer
      </button>

      {ouvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="widgets-titre">
          <button
            aria-hidden
            tabIndex={-1}
            onClick={() => setOuvert(false)}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm cursor-default"
          />

          <div
            ref={panneauRef}
            tabIndex={-1}
            style={{ outline: 'none', borderRadius: '1rem' }}
            className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-5"
          >
            <h2 id="widgets-titre" className="text-base font-bold text-slate-900 dark:text-white">
              Widgets de l’accueil
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Choisissez ce qui s’affiche. Vos rendez-vous restent toujours visibles.
            </p>

            <div className="mt-4 space-y-1">
              {WIDGETS.map(w => {
                const coche = selection.has(w.key)
                return (
                  <label
                    key={w.key}
                    className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={coche}
                      onChange={() => basculer(w.key)}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 shrink-0"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">{w.label}</span>
                      <span className="block text-xs text-slate-400 dark:text-slate-500 mt-0.5">{w.description}</span>
                    </span>
                  </label>
                )
              })}
            </div>

            {erreur && <p className="text-xs text-red-600 dark:text-red-400 mt-3">{erreur}</p>}

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setOuvert(false)}
                className="flex-1 py-2.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl transition-colors border border-slate-200 dark:border-slate-700"
              >
                Annuler
              </button>
              <button
                onClick={enregistrer}
                disabled={enregistrement}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-xl transition-colors"
              >
                {enregistrement ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

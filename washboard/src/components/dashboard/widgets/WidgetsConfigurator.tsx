'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Settings, ChevronUp, ChevronDown } from 'lucide-react'
import { WIDGETS, type WidgetKey } from '@/lib/dashboardWidgets'

// Bouton « Configurer » de l'accueil : afficher ou masquer chacun des
// widgets, ET les réordonner — des flèches haut/bas plutôt qu'un
// glisser-déposer, qui se manie mal au clavier et n'est jamais aussi fiable au
// doigt qu'à la souris ; les flèches fonctionnent identiquement partout.
//
// Le réglage est écrit en base (washers.dashboard_widgets) et non en
// localStorage : il doit rester le même d'un appareil à l'autre, ordinateur
// le jour, téléphone le soir. Le tableau enregistré porte à la fois la
// sélection ET l'ordre — un widget qui n'y figure pas est simplement masqué.
//
// À l'enregistrement, `router.refresh()` relance le composant serveur de la
// page : c'est LUI qui décide quelles données charger pour quels widgets. Un
// widget masqué n'est donc pas seulement caché en CSS, sa requête n'est plus
// jamais faite.

export function WidgetsConfigurator({ visibles }: { visibles: WidgetKey[] }) {
  const router = useRouter()
  const [ouvert, setOuvert] = useState(false)

  // Tous les widgets, dans l'ordre à afficher dans le panneau : d'abord ceux
  // déjà visibles (dans leur ordre enregistré), puis les autres à la suite.
  // Sert de point de départ aux flèches, qu'un widget soit coché ou non.
  const ordreInitial = useMemo(() => {
    const restants = WIDGETS.map(w => w.key).filter(k => !visibles.includes(k))
    return [...visibles, ...restants]
  }, [visibles])

  const [ordre, setOrdre] = useState<WidgetKey[]>(ordreInitial)
  const [coches, setCoches] = useState<Set<WidgetKey>>(() => new Set(visibles))
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const panneauRef = useRef<HTMLDivElement>(null)

  // Resynchronise si la page a été rafraîchie ailleurs pendant que le panneau
  // était fermé (un autre onglet, par exemple).
  useEffect(() => {
    if (!ouvert) {
      setOrdre(ordreInitial)
      setCoches(new Set(visibles))
    }
  }, [ordreInitial, visibles, ouvert])

  useEffect(() => {
    if (!ouvert) return
    panneauRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOuvert(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [ouvert])

  function basculer(cle: WidgetKey) {
    setCoches(prev => {
      const next = new Set(prev)
      if (next.has(cle)) next.delete(cle)
      else next.add(cle)
      return next
    })
  }

  function deplacer(index: number, sens: -1 | 1) {
    const cible = index + sens
    if (cible < 0 || cible >= ordre.length) return
    setOrdre(prev => {
      const next = [...prev]
      ;[next[index], next[cible]] = [next[cible], next[index]]
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
        // L'ordre du tableau EST l'ordre d'affichage : seuls les widgets
        // cochés y figurent, dans leur position actuelle dans le panneau.
        body: JSON.stringify({ dashboard_widgets: ordre.filter(k => coches.has(k)) }),
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

  const parCle = new Map(WIDGETS.map(w => [w.key, w]))

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
              Choisissez ce qui s’affiche, et dans quel ordre. Vos rendez-vous restent toujours visibles.
            </p>

            <div className="mt-4 space-y-1">
              {ordre.map((cle, index) => {
                const w = parCle.get(cle)
                if (!w) return null
                const coche = coches.has(cle)
                return (
                  <div
                    key={cle}
                    className="flex items-center gap-2 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <label className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={coche}
                        onChange={() => basculer(cle)}
                        className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 shrink-0"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">{w.label}</span>
                        <span className="block text-xs text-slate-400 dark:text-slate-500 mt-0.5">{w.description}</span>
                      </span>
                    </label>
                    <div className="flex flex-col shrink-0">
                      <button
                        type="button"
                        onClick={() => deplacer(index, -1)}
                        disabled={index === 0}
                        aria-label={`Monter ${w.label}`}
                        className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deplacer(index, 1)}
                        disabled={index === ordre.length - 1}
                        aria-label={`Descendre ${w.label}`}
                        className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronDown size={16} />
                      </button>
                    </div>
                  </div>
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

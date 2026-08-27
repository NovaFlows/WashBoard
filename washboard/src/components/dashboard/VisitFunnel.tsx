import type { FunnelStepStat } from '@/lib/funnelStats'

type Props = {
  stats: FunnelStepStat[]
  accent?: string
  /** Nombre de jours couverts par `stats`, pour l'affichage du titre. */
  windowDays: number
}

// Entonnoir de la page de réservation publique : où les visiteurs décrochent.
// Une seule série (nombre de sessions) → pas besoin de légende, chaque barre
// est directement étiquetée (voir dataviz: identity via label, pas couleur).
export default function VisitFunnel({ stats, accent = '#2563eb', windowDays }: Props) {
  const hasData = stats.some(s => s.sessions > 0)

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Entonnoir de réservation</h3>
        <span className="text-[11px] text-slate-400 dark:text-slate-500">{windowDays} derniers jours</span>
      </div>
      <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-4">
        Visiteurs de votre page de réservation, par étape atteinte.
      </p>

      {!hasData ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 py-4 text-center">
          Pas encore de visite mesurée sur cette période.
        </p>
      ) : (
        <div className="space-y-3">
          {stats.map((s, i) => (
            <div key={s.step}>
              <div className="flex items-center justify-between mb-1 text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300">{s.label}</span>
                <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                  {s.sessions} · {s.pctOfFirst}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.max(s.pctOfFirst, s.sessions > 0 ? 2 : 0)}%`, backgroundColor: accent }}
                />
              </div>
              {i > 0 && s.pctDropFromPrevious > 0 && (
                <p className="text-[11px] text-rose-500 dark:text-rose-400 mt-1">
                  −{s.pctDropFromPrevious}% par rapport à l&rsquo;étape précédente
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

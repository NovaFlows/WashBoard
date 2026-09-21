import Link from 'next/link'
import { formatConversionRate } from '@/lib/funnelStats'

// Même définition que la page CRM, au chiffre près : la conversion rapporte
// les sessions ayant atteint l'étape « confirmation » à celles ayant atteint
// « prestation » (la toute première étape suivie). Un chiffre qui contredirait
// celui du CRM serait pire qu'aucun chiffre.

export function TraficWidget({
  visiteurs, conversions, sources,
}: {
  visiteurs: number
  conversions: number
  /** Deux premières sources, déjà triées — voir buildReferrerBreakdown. */
  sources: { host: string; pct: number }[]
}) {
  return (
    <Link
      href="/dashboard/crm"
      className="block bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 transition-transform duration-150 [@media(hover:hover)]:hover:scale-[1.02] motion-reduce:transition-none motion-reduce:hover:scale-100 hover:border-slate-300 dark:hover:border-slate-700"
    >
      <h2 className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500 mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
        Trafic &amp; conversion
      </h2>

      {visiteurs === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Aucun visiteur ce mois-ci.</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-2xl font-mono font-bold text-blue-600 dark:text-blue-400 tabular-nums">{formatConversionRate(conversions, visiteurs)}</span>
            <span className="text-[10px] uppercase tracking-wide font-semibold text-slate-400 dark:text-slate-500">
              conversion · {conversions}/{visiteurs}
            </span>
          </div>

          {sources.length > 0 && (
            <div className="space-y-1">
              {sources.map(s => (
                <div key={s.host} className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400 truncate">{s.host === 'direct' ? 'Accès direct' : s.host}</span>
                  <span className="font-mono text-slate-400 dark:text-slate-500 tabular-nums shrink-0 ml-2">{s.pct}%</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Link>
  )
}

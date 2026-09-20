import Link from 'next/link'

export function ClientsWidget({ total, nouveauxCeMois }: { total: number; nouveauxCeMois: number }) {
  return (
    <Link
      href="/dashboard/clients"
      className="block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
    >
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Clients</h2>
      <div className="flex items-end gap-4">
        <div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">{total}</p>
          <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">au total</p>
        </div>
        {nouveauxCeMois > 0 && (
          <div>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">+{nouveauxCeMois}</p>
            <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">nouveaux ce mois</p>
          </div>
        )}
      </div>
    </Link>
  )
}

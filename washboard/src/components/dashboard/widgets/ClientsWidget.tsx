import Link from 'next/link'

export function ClientsWidget({
  total, nouveauxCeMois, visiteursCeMois,
}: {
  total: number
  nouveauxCeMois: number
  /** Sessions distinctes sur la page de réservation ce mois-ci — même
   *  définition que le CRM (`countDistinctSessions`), pour que ce chiffre ne
   *  raconte jamais une histoire différente de celui de la page CRM. */
  visiteursCeMois: number
}) {
  return (
    <Link
      href="/dashboard/clients"
      className="block bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 transition-transform duration-150 [@media(hover:hover)]:hover:scale-[1.02] motion-reduce:transition-none motion-reduce:hover:scale-100 hover:border-slate-300 dark:hover:border-slate-700"
    >
      <h2 className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500 mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
        Clients
      </h2>
      <div className="flex items-end gap-4 flex-wrap">
        <div>
          <p className="text-2xl font-mono font-bold text-blue-600 dark:text-blue-400 tabular-nums">{total}</p>
          <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-400 dark:text-slate-500 mt-1.5">au total</p>
        </div>
        {nouveauxCeMois > 0 && (
          <div>
            <p className="text-2xl font-mono font-bold text-blue-600 dark:text-blue-400 tabular-nums">+{nouveauxCeMois}</p>
            <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-400 dark:text-slate-500 mt-1.5">nouveaux · mois</p>
          </div>
        )}
        <div>
          <p className="text-2xl font-mono font-bold text-blue-600 dark:text-blue-400 tabular-nums">{visiteursCeMois}</p>
          <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-400 dark:text-slate-500 mt-1.5">visiteurs · mois</p>
        </div>
      </div>
    </Link>
  )
}

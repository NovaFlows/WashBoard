import Link from 'next/link'

export type PrestationComptee = { nom: string; nombre: number }

export function PrestationsWidget({ prestations }: { prestations: PrestationComptee[] }) {
  const total = prestations.reduce((s, p) => s + p.nombre, 0)

  return (
    <Link
      href="/dashboard/admin#prestations"
      className="block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 transition-transform duration-150 [@media(hover:hover)]:hover:scale-[1.02] motion-reduce:transition-none motion-reduce:hover:scale-100 hover:border-slate-300 dark:hover:border-slate-700"
    >
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Prestations</h2>

      {prestations.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Aucun rendez-vous ce mois-ci.</p>
      ) : (
        <div className="space-y-2">
          {prestations.slice(0, 3).map(p => (
            <div key={p.nom}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-slate-700 dark:text-slate-300 truncate">{p.nom}</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums shrink-0 ml-2">{p.nombre}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500"
                  style={{ width: `${total > 0 ? Math.round((p.nombre / total) * 100) : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Link>
  )
}

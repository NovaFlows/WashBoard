import Link from 'next/link'

export function ClientsWidget({
  total, nouveauxCetteSemaine,
}: {
  total: number
  nouveauxCetteSemaine: number
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 transition-transform duration-150 [@media(hover:hover)]:hover:scale-[1.02] motion-reduce:transition-none motion-reduce:hover:scale-100 hover:border-slate-300 dark:hover:border-slate-700">
      <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500">
          Clients
        </h2>
        {/* Demandé explicitement à CET endroit (plutôt qu'un raccourci séparé
            en haut de l'accueil) : l'action de suivi vit dans la carte
            qu'elle prolonge. */}
        <Link
          href="/dashboard/clients"
          className="text-[10px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400 hover:opacity-70 transition-opacity shrink-0"
        >
          Suivre mes clients →
        </Link>
      </div>

      <div className="flex items-end gap-4 flex-wrap">
        <div>
          <p className="text-2xl font-mono font-bold text-blue-600 dark:text-blue-400 tabular-nums">{total}</p>
          <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-400 dark:text-slate-500 mt-1.5">au total</p>
        </div>
        {nouveauxCetteSemaine > 0 && (
          <div>
            {/* Vert assumé : un nombre de nouveaux clients en plus est
                réellement une bonne nouvelle, contrairement aux autres
                chiffres du tableau de bord qui ne sont que des catégories. */}
            <p className="text-2xl font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">+{nouveauxCetteSemaine}</p>
            <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-400 dark:text-slate-500 mt-1.5">nouveaux · semaine</p>
          </div>
        )}
      </div>
    </div>
  )
}
